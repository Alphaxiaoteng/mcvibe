import { generateRealisticOrderHistory } from '../core/mock_data.js';
import { VibeAggregator } from '../core/vibe_aggregator.js';
import { McpClient } from '../core/mcp_client.js';

async function main() {
  const mcpClient = new McpClient();
  const orders = generateRealisticOrderHistory();
  const summary = await VibeAggregator.computeSummary(orders, mcpClient);

  console.log('\n\x1b[33m%s\x1b[0m', '  ███╗   ███╗ ██████╗██╗   ██╗██╗██████╗ ███████╗');
  console.log('\x1b[33m%s\x1b[0m', '  ████╗ ████║██╔════╝██║   ██║██║██╔══██╗██╔════╝');
  console.log('\x1b[33m%s\x1b[0m', '  ██╔████╔██║██║     ██║   ██║██║██████╔╝█████╗  ');
  console.log('\x1b[31m%s\x1b[0m', '  ██║╚██╔╝██║██║     ╚██╗ ██╔╝██║██╔══██╗██╔══╝  ');
  console.log('\x1b[31m%s\x1b[0m', '  ██║ ╚═╝ ██║╚██████╗ ╚████╔╝ ██║██████╔╝███████╗');
  console.log('\x1b[31m%s\x1b[0m', '  ╚═╝     ╚═╝ ╚═════╝  ╚═══╝  ╚═╝╚═════╝ ╚══════╝');
  console.log('\x1b[36m%s\x1b[0m\n', '   [McVibe] 麦门足迹 · 个人数据仪表盘\n');

  console.log('\x1b[1m=== 今日状态 & 极客生命槽 ===\x1b[0m');
  console.log(`[用户] ${summary.user.nickname} (${summary.user.title})`);
  console.log(`[今日消费] ¥${summary.today.spent} (${summary.today.orderCount} 顿) | 立省 ¥${summary.today.saved}`);
  console.log(`[HP 饱腹精力] [${'█'.repeat(Math.floor(summary.today.hp / 10))}${'░'.repeat(10 - Math.floor(summary.today.hp / 10))}] ${summary.today.hp}%`);
  console.log(`[MP 咖啡因槽] [${'█'.repeat(Math.floor(summary.today.mp / 10))}${'░'.repeat(10 - Math.floor(summary.today.mp / 10))}] ${summary.today.mp}%\n`);

  console.log('\x1b[1m=== 麦门全景足迹 ===\x1b[0m');
  console.log(`• 累计吃麦: ${summary.stats.totalOrders} 顿 (总金额 ¥${summary.stats.totalSpent})`);
  console.log(`• 累计白嫖抵扣: \x1b[32m¥${summary.stats.totalSaved}\x1b[0m (抵扣率 ${summary.stats.savingRatePercent}%)`);
  console.log(`• 连续吃麦连击: \x1b[31m${summary.stats.currentStreak} DAYS STREAK\x1b[0m (最长 ${summary.stats.longestStreak} 天)`);
  console.log(`• 积分资产余额: \x1b[33m${summary.user.points} 点\x1b[0m (官方 MCP 校验通过)\n`);

  console.log('\x1b[1m=== 麦门常驻英雄榜 TOP 3 ===\x1b[0m');
  summary.topItems.slice(0, 3).forEach((item, idx) => {
    const medals = ['#1', '#2', '#3'];
    console.log(`  ${medals[idx]} ${item.name.padEnd(12)} x ${item.count} 次 (累计 ¥${item.totalSpent}) -> ${item.pixelBadge}`);
  });

  console.log('\n\x1b[1m=== 最近 7 周吃麦活跃度预览 (Dot Matrix) ===\x1b[0m');
  const recentDays = summary.heatmap.slice(-49); // 7 weeks * 7 days
  const icons = ['·', '▪', '■', '█', '★'];
  let rowStr = '  ';
  recentDays.forEach((d, i) => {
    rowStr += `${icons[d.intensity]} `;
    if ((i + 1) % 7 === 0) {
      console.log(rowStr);
      rowStr = '  ';
    }
  });

  console.log('\n\x1b[35m[Tip] 启动完整 8-Bit 像素 Web 画布与音效面板: PORT=3001 npm run web\x1b[0m\n');
}

main().catch(err => {
  console.error('McVibe CLI Error:', err);
  process.exit(1);
});
