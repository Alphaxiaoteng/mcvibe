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
