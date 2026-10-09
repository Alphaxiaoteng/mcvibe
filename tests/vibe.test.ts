import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRealisticOrderHistory } from '../src/core/mock_data.js';
import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { AchievementEngine } from '../src/core/achievement_engine.js';
import { McpClient } from '../src/core/mcp_client.js';

test('MockData - generates realistic order history across 24 weeks', () => {
  const orders = generateRealisticOrderHistory();
  assert.ok(orders.length >= 30, 'Should generate substantial historical orders');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const hasToday = orders.some(o => o.date === todayStr);
  assert.equal(hasToday, true, 'Should include today order record');
});

test('VibeAggregator - generateHeatmap builds exactly 24-week (168 days) grid', () => {
  const orders = generateRealisticOrderHistory();
  const heatmap = VibeAggregator.generateHeatmap(orders, 24);
  assert.equal(heatmap.length, 168, 'Heatmap should contain exactly 168 days');

  for (const day of heatmap) {
    assert.ok(day.intensity >= 0 && day.intensity <= 4, 'Intensity should be bounded 0-4');
    assert.ok(day.dayOfWeek >= 0 && day.dayOfWeek <= 6, 'Day of week should be valid');
    assert.ok(day.totalSpent >= 0, 'Spent amount should be non-negative');
  }
});

test('VibeAggregator - computeCategoryBreakdown calculates valid percentages', () => {
  const orders = generateRealisticOrderHistory();
  const breakdown = VibeAggregator.computeCategoryBreakdown(orders);
  
  assert.ok(breakdown.length > 0, 'Should have category breakdown items');
  const totalPercent = breakdown.reduce((sum, b) => sum + b.percentage, 0);
  assert.ok(totalPercent >= 98 && totalPercent <= 102, `Percentages should sum to ~100%, got ${totalPercent}`);
});

test('AchievementEngine - evaluates achievements correctly', () => {
  const orders = generateRealisticOrderHistory();
  const achievements = AchievementEngine.evaluateAchievements(orders);
  
  assert.equal(achievements.length, 8, 'Should evaluate 8 pixel achievements');
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  assert.ok(unlockedCount > 0, 'At least one achievement should be unlocked with rich history');
});

test('VibeAggregator - computeSummary compiles full Vibe analytics with MCP client', async () => {
  const orders = generateRealisticOrderHistory();
  const mcpClient = new McpClient({ forceSandbox: true });
  const summary = await VibeAggregator.computeSummary(orders, mcpClient);

  assert.ok(summary.user.nickname.length > 0);
  assert.ok(summary.stats.totalSpent > 0);
  assert.ok(summary.stats.totalOrders > 0);
  assert.ok(summary.today.hp >= 0 && summary.today.hp <= 100);
  assert.ok(summary.today.mp >= 0 && summary.today.mp <= 100);
  assert.equal(summary.mcpStatus.isConnected, true);
  assert.equal(summary.mcpStatus.couponsAvailable, 5);
});
