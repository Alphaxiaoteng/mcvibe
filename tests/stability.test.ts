import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { McpClient } from '../src/core/mcp_client.js';
import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { OrderRecord } from '../src/core/types.js';
import { server } from '../src/web/server.js';

test('稳定性测试 (Stability Test) - MCP 客户端超时保护机制', async () => {
  // 配置一个连接到黑洞地址的客户端，设置超短超时 300ms
  const slowClient = new McpClient({
    token: 'MCD_TIMEOUT_PROBE_TOKEN',
    baseUrl: 'http://10.255.255.1:9999', // 不可达黑洞地址
    timeoutMs: 300
  });

  const startTime = Date.now();
  const res = await slowClient.testConnection();
  const elapsed = Date.now() - startTime;

  assert.equal(res.success, false, '不可达端点应连接失败');
  assert.ok(slowClient.isUsingSandbox(), '超时或失败后必须自动降级到沙盒模式');
  assert.ok(elapsed < 2000, `超时控制应迅速生效 (实际耗时 ${elapsed}ms)`);
});

test('稳定性测试 (Stability Test) - 全链路防 NaN 与脏数据极端熔断', async () => {
  const dirtyClient = new McpClient({ forceSandbox: true });

  // 构造极端脏数据订单列表
  const dirtyOrders: OrderRecord[] = [
    {
      id: 'DIRTY-1',
      date: 'INVALID_DATE_FORMAT',
      timestamp: 'NOT_A_TIMESTAMP',
      items: [
        { id: '1', name: '神秘产品', category: 'burger', count: NaN as any, price: NaN as any, calories: NaN as any }
      ],
      paidAmount: NaN as any,
      discountAmount: NaN as any,
      totalPrice: NaN as any,
      pointsEarned: NaN as any,
      diningType: 'dine_in',
      storeName: '未知餐厅'
    },
    {
      id: 'DIRTY-2',
      date: '2026-05-01',
      timestamp: '2026-05-01T12:00:00',
      items: [],
      paidAmount: -50, // 负数金额
      discountAmount: -20,
      totalPrice: -70,
      pointsEarned: 0,
      diningType: 'dine_in',
      storeName: ''
    }
  ];

  const summary = await VibeAggregator.computeSummary(dirtyOrders, dirtyClient);

  // 验证所有产出字段均为合法有限数值，杜绝前端渲染白屏或 NaN 泄露
  assert.ok(Number.isFinite(summary.stats.totalSpent), 'totalSpent 必须为有限数字');
  assert.ok(Number.isFinite(summary.stats.totalOrders), 'totalOrders 必须为有限数字');
  assert.ok(Number.isFinite(summary.stats.avgOrderPrice), 'avgOrderPrice 必须为有限数字');
  assert.ok(Number.isFinite(summary.stats.savingRatePercent), 'savingRatePercent 必须为有限数字');
  assert.ok(Number.isFinite(summary.user.points), 'user.points 必须为有限数字');
  assert.ok(Number.isFinite(summary.today.hp), 'today.hp 必须为有限数字');
  assert.ok(Number.isFinite(summary.today.mp), 'today.mp 必须为有限数字');
  assert.ok(summary.today.hp >= 0 && summary.today.hp <= 100, 'hp 必须在 0-100 之间');
  assert.ok(summary.today.mp >= 0 && summary.today.mp <= 100, 'mp 必须在 0-100 之间');

  const expiryRate = summary.usageInsights?.pointsEfficiency?.expiryRatePercent ?? 0;
  assert.ok(Number.isFinite(expiryRate), 'expiryRatePercent 必须为有限数字');
});

test('稳定性测试 (Stability Test) - HTTP 服务端畸形请求防御与防大包攻击', async () => {
  const testServer = http.createServer(server.listeners('request')[0] as any);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const port = (testServer.address() as any).port;

  try {
    // 1. 发送畸形 JSON
    const brokenJsonRes = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      const req = http.request(
        `http://localhost:${port}/api/vibe/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
        }
      );
      req.on('error', reject);
      req.write('<<<BROKEN_JSON_BODY>>>');
      req.end();
    });

    assert.equal(brokenJsonRes.statusCode, 400, '畸形 JSON 必须返回 HTTP 400');

    // 2. 发送超大 Payload (超过 64KB)
    const hugeData = JSON.stringify({ token: 'A'.repeat(80 * 1024) });
    const hugeRes = await new Promise<{ statusCode: number; data: string }>((resolve) => {
      const req = http.request(
        `http://localhost:${port}/api/vibe/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
        }
      );
      req.on('error', () => {
        resolve({ statusCode: 413, data: 'destroyed' });
      });
      req.write(hugeData);
      req.end();
    });

    assert.ok(
      hugeRes.statusCode === 413 || hugeRes.statusCode === 400 || hugeRes.data === 'destroyed',
      `超大请求体必须被拒绝拦截 (实际状态: ${hugeRes.statusCode})`
    );
  } finally {
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  }
});

test('稳定性测试 (Stability Test) - 自然年点阵谱连续性与跨年份周整倍数对齐', () => {
  const testYears = [2024, 2025, 2026, 2027]; // 包含 2024 闰年

  for (const yr of testYears) {
    const heatmap = VibeAggregator.generateYearHeatmap([], yr);

    // 点阵图必须严格按周完整对齐 (总天数必须为 7 的整数倍)
    assert.equal(heatmap.length % 7, 0, `${yr} 年热力图天数必须整除 7`);

    // 首日必须为周日 (dayOfWeek === 0)，末日必须为周六 (dayOfWeek === 6)
    assert.equal(heatmap[0].dayOfWeek, 0, `${yr} 年首个方格必须为周日`);
    assert.equal(heatmap[heatmap.length - 1].dayOfWeek, 6, `${yr} 年末尾方格必须为周六`);

    // 日期必须严格连续，无间隔与断层
    for (let i = 1; i < heatmap.length; i++) {
      const prevDate = new Date(heatmap[i - 1].date);
      const currDate = new Date(heatmap[i].date);
      const diff = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
      assert.equal(diff, 1, `${heatmap[i - 1].date} 到 ${heatmap[i].date} 必须严格相差 1 天`);
    }
  }
});

test('稳定性测试 (Stability Test) - 生产源码与静态部署目录 100% 同步一致性', () => {
  const srcPath = path.resolve('src/web/public/index.html');
  const docsPath = path.resolve('docs/index.html');

  assert.ok(fs.existsSync(srcPath), 'src 目录下的 index.html 必须存在');
  assert.ok(fs.existsSync(docsPath), 'docs 目录下的 index.html 必须存在');

  const srcContent = fs.readFileSync(srcPath, 'utf-8');
  const docsContent = fs.readFileSync(docsPath, 'utf-8');

  assert.equal(srcContent, docsContent, 'docs/index.html 必须与 src/web/public/index.html 完全一致');
});
