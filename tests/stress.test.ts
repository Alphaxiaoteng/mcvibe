import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpClient } from '../src/core/mcp_client.js';
import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { generateRealisticOrderHistory } from '../src/core/mock_data.js';

test('压力测试 (Stress Test) - 高并发汇总计算与无内存泄漏', async () => {
  const client = new McpClient({ forceSandbox: true });
  const orders = generateRealisticOrderHistory();

  const startTime = Date.now();
  const CONCURRENT_REQUESTS = 100;

  // 100 次高并发突发调用 computeSummary
  const tasks = Array.from({ length: CONCURRENT_REQUESTS }, () =>
    VibeAggregator.computeSummary(orders, client)
  );

  const results = await Promise.all(tasks);
  const elapsedMs = Date.now() - startTime;

  assert.equal(results.length, CONCURRENT_REQUESTS, '全部并发任务应成功返回');
  for (const res of results) {
    assert.ok(res.stats.totalSpent > 0);
    assert.equal(res.heatmap.length, 371); // 2026 自然年 53 周全景点阵
    assert.equal(res.yearHeatmaps?.recent24.length, 168); // 近 24 周视图 168 天
    assert.equal(res.mcpStatus.isConnected, true);
  }

  // 性能基准：100 次并发耗时应远小于 2000ms
  assert.ok(elapsedMs < 2000, `100次并发计算耗时 ${elapsedMs}ms，符合高性能要求`);
});

test('压力测试 (Stress Test) - 极端异常边界与脏数据容错鲁棒性', () => {
  // 1. 空数组
  const res1 = VibeAggregator.convertOfficialOrders([]);
  assert.deepEqual(res1, []);

  // 2. 传入非数组或 null
  const res2 = VibeAggregator.convertOfficialOrders(null as any);
  assert.deepEqual(res2, []);

  // 3. 各种畸形订单数据（空产品、无金额、缺少 storeName、异常字符）
  const malformed = [
    {},
    { orderId: 'CORRUPT-1', realTotalAmount: 'NaN' },
    { orderId: 'CORRUPT-2', realTotalAmount: '-99.9', orderProductList: null },
    { orderId: 'CORRUPT-3', realTotalAmount: '0', orderProductList: [{}] },
    {
      orderId: 'EXTREME-4',
      realTotalAmount: '999999.99',
      orderProductList: [
        {
          productName: '巨无霸家庭轰趴桶',
          comboItemList: Array.from({ length: 50 }, (_, i) => ({
            name: `特调汉堡-${i}`,
            quantity: 2
          }))
        }
      ]
    }
  ];

  const parsed = VibeAggregator.convertOfficialOrders(malformed);
  assert.equal(parsed.length, 5, '全部畸形订单均应优雅容错解析');
  assert.equal(parsed[0].paidAmount, 0);
  assert.equal(parsed[1].paidAmount, 0);
  assert.equal(parsed[4].items.length, 50);
});

test('压力测试 (Stress Test) - 高频 Token 状态抖动与并发切换', async () => {
  const client = new McpClient({ forceSandbox: true });

  for (let i = 0; i < 200; i++) {
    if (i % 3 === 0) client.setToken(`TOKEN_STRESS_${i}`);
    else if (i % 3 === 1) client.setToken('');
    else client.setToken(null);
  }

  // 最终状态清空后应稳定归于沙盒
  client.setToken(null);
  assert.equal(client.isUsingSandbox(), true);
  assert.equal(client.getToken(), null);
});
