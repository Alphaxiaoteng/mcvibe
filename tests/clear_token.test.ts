import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpClient } from '../src/core/mcp_client.js';
import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { generateRealisticOrderHistory } from '../src/core/mock_data.js';

test('清空测试 (Clear Token Test) - 内存状态彻底抹除与沙盒无缝切换', async () => {
  const client = new McpClient();

  // 1. 模拟绑定 Token
  client.setToken('MCD_TEMP_TEST_TOKEN_12345678');
  assert.equal(client.isUsingSandbox(), false, '绑定 Token 后应处于 Live 模式');
  assert.equal(client.getToken(), 'MCD_TEMP_TEST_TOKEN_12345678');
  assert.equal(client.getMaskedToken(), 'MCD_...5678');

  // 2. 触发清空 Token (空字符串)
  client.setToken('');
  assert.equal(client.isUsingSandbox(), true, '清空 Token 后应立即安全切回沙盒模式');
  assert.equal(client.getToken(), null, 'Token 应彻底从内存清空为 null');
  assert.equal(client.getMaskedToken(), null, '脱敏 Token 应为 null');

  // 3. 再次传入 null 确认幂等性
  client.setToken(null);
  assert.equal(client.isUsingSandbox(), true);
  assert.equal(client.getToken(), null);

  // 4. 清空后调用工具，应纯净走沙盒数据，无历史残留
  const acc = await client.callTool('query-my-account');
  assert.equal(acc.availablePoint, '3420');

  const orders = generateRealisticOrderHistory();
  const summary = await VibeAggregator.computeSummary(orders, client);
  assert.equal(summary.mcpStatus.isSandbox, true);
  assert.equal(summary.mcpStatus.tokenConfigured, false);
  assert.equal(summary.mcpStatus.tokenMasked, undefined);
  assert.equal(summary.user.nickname, 'CyberMaimen');
});

test('零收集与空状态测试 (Zero-Collection Empty State) - 每个人打开都是完全空的，无虚假数据', () => {
  const empty = VibeAggregator.createEmptySummary();

  assert.equal(empty.stats.totalOrders, 0, '未连接时订单数必须为 0');
  assert.equal(empty.stats.totalSpent, 0, '未连接时总消费必须为 0');
  assert.equal(empty.stats.totalSaved, 0, '未连接时总节省必须为 0');
  assert.equal(empty.user.points, 0, '未连接时积分必须为 0');
  assert.equal(empty.recentOrders?.length, 0, '未连接时订单列表必须为空数组');
  assert.equal(empty.breakdown.length, 0, '未连接时分类统计必须为空数组');
  assert.equal(empty.topItems.length, 0, '未连接时冠军榜必须为空数组');

  // 热力图必须全灰 (所有方格点亮强度为 0)
  for (const day of empty.heatmap) {
    assert.equal(day.count, 0, '空状态单日吃麦次数必须为 0');
    assert.equal(day.intensity, 0, '空状态单日热力强度必须为 0');
    assert.equal(day.totalSpent, 0, '空状态单日消费必须为 0');
  }
});
