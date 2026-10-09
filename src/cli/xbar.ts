import { generateRealisticOrderHistory } from '../core/mock_data.js';
import { VibeAggregator } from '../core/vibe_aggregator.js';
import { McpClient } from '../core/mcp_client.js';

async function main() {
  const mcpClient = new McpClient();
  const orders = mcpClient.isUsingSandbox() ? generateRealisticOrderHistory() : [];
  const summary = await VibeAggregator.computeSummary(orders, mcpClient);

  const icon = summary.today.orderCount > 0 ? '🍔' : '🍟';
  const color = summary.today.orderCount > 0 ? 'red' : 'orange';
  const prefix = mcpClient.isUsingSandbox() ? 'Sandbox: ' : '';
  
  // 主状态栏文本 (xbar / SwiftBar 规范)
  console.log(`${icon} ${summary.user.points} 积分 | color=${color}`);
  console.log('---');
  console.log(`👤 ${summary.user.nickname} (${summary.user.title}) | color=gray`);
  if (mcpClient.isUsingSandbox()) {
    console.log(`⚠️ 当前为纯净沙盒模式 (未配置 Token) | color=red`);
    console.log(`设置 MCD_MCP_TOKEN 环境变量可拉取真实数据`);
    console.log('---');
  } else {
    console.log(`🟢 官方真实 MCP 已连接 | color=green`);
    console.log('---');
  }

  console.log('麦门数据面板');
  console.log(`今日消费: ¥${summary.today.spent} (${summary.today.orderCount} 顿) | 立省 ¥${summary.today.saved}`);
  console.log(`当前连击: ${summary.stats.currentStreak} DAYS 🔥 (最高 ${summary.stats.longestStreak} 天)`);
  console.log(`累计吃麦: ${summary.stats.totalOrders} 顿`);
  console.log(`历史白嫖: ¥${summary.stats.totalSaved}`);
  console.log('---');
  
  console.log('常驻英雄榜 (Top 3)');
  summary.topItems.slice(0, 3).forEach((item, idx) => {
    const medals = ['🥇', '🥈', '🥉'];
    console.log(`${medals[idx]} ${item.name} x ${item.count}次`);
  });
  console.log('---');
  console.log('打开 McVibe 完整面板 (Web) | bash="/usr/bin/env" param1="npm" param2="run" param3="web" terminal=true');
}

main().catch(err => {
  console.log('⚠️ McVibe Error');
  console.log('---');
  console.log(err.message);
  process.exit(1);
});
