import { OrderRecord, Achievement } from './types.js';

export class AchievementEngine {
  public static evaluateAchievements(orders: OrderRecord[]): Achievement[] {
    const totalOrders = orders.length;
    const totalSaved = orders.reduce((sum, o) => sum + o.discountAmount, 0);

    // 计算最长连续打卡天数 (streak)
    const uniqueDates = Array.from(new Set(orders.map(o => o.date))).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1]).getTime();
        const curr = new Date(uniqueDates[i]).getTime();
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }

    // 检查最近打卡是否连接到今天或昨天
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const hasRecent = uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr);
    currentStreak = hasRecent ? tempStreak : 0;

    // 统计各项特征
    let coffeeCount = 0;
    let burgerCount = 0;
    let thursdayCount = 0;
    let budgetOrders = 0;
    let healthHacks = 0;

    for (const order of orders) {
      const dayOfWeek = new Date(order.date).getDay();
      if (dayOfWeek === 4) {
        thursdayCount++;
      }
      if (order.paidAmount <= 18.0) {
        budgetOrders++;
      }

      for (const item of order.items) {
        if (item.name.includes('咖啡') || item.name.includes('美式') || item.name.includes('拿铁')) {
          coffeeCount += item.count;
        }
        if (item.category === 'burger') {
          burgerCount += item.count;
        }
        if (item.name.includes('玉米') || (item.customization && item.customization.includes('去沙拉酱'))) {
          healthHacks += item.count;
        }
      }
    }

    const achievements: Achievement[] = [
      {
        id: 'ACH_STREAK_3',
        title: '初级麦客',
        pixelIcon: '🌱',
        description: '连续 3 天打卡麦当劳',
        category: 'streak',
        unlocked: longestStreak >= 3,
        progress: Math.min(longestStreak, 3),
        maxProgress: 3,
        unlockedAt: longestStreak >= 3 ? '已解锁' : undefined
      },
      {
        id: 'ACH_STREAK_7',
        title: '麦门狂信徒',
        pixelIcon: '👑',
        description: '连续 7 天不间断吃麦',
        category: 'streak',
        unlocked: longestStreak >= 7,
        progress: Math.min(longestStreak, 7),
        maxProgress: 7,
        unlockedAt: longestStreak >= 7 ? '已解锁' : undefined
      },
      {
        id: 'ACH_CAFFEINE_LOOP',
        title: '咖啡因永动机',
        pixelIcon: '☕',
        description: '累计消耗 15 杯鲜煮/现磨黑咖啡',
        category: 'taste',
        unlocked: coffeeCount >= 15,
        progress: Math.min(coffeeCount, 15),
        maxProgress: 15,
        unlockedAt: coffeeCount >= 15 ? '已解锁' : undefined
      },
      {
        id: 'ACH_POOR_COMBO',
        title: '穷鬼护体',
        pixelIcon: '🛡️',
        description: '单笔订单实付 ≤ ¥18 达到 10 次',
        category: 'saving',
        unlocked: budgetOrders >= 10,
        progress: Math.min(budgetOrders, 10),
        maxProgress: 10,
        unlockedAt: budgetOrders >= 10 ? '已解锁' : undefined
      },
      {
        id: 'ACH_THURSDAY_CRAZY',
        title: '疯狂星期四',
        pixelIcon: '⚡',
        description: '周四会员狂欢日吃麦达到 6 次',
        category: 'loyalty',
        unlocked: thursdayCount >= 6,
        progress: Math.min(thursdayCount, 6),
        maxProgress: 6,
        unlockedAt: thursdayCount >= 6 ? '已解锁' : undefined
      },
      {
        id: 'ACH_BURGER_CHAMP',
        title: '双吉终结者',
        pixelIcon: '🍔',
        description: '累计享用汉堡主食超过 20 个',
        category: 'taste',
        unlocked: burgerCount >= 20,
        progress: Math.min(burgerCount, 20),
        maxProgress: 20,
        unlockedAt: burgerCount >= 20 ? '已解锁' : undefined
      },
      {
        id: 'ACH_COUPON_SAVER',
        title: '羊毛精算大师',
        pixelIcon: '💰',
        description: '累计通过优惠券抵扣省下超过 ¥100',
        category: 'saving',
        unlocked: totalSaved >= 100,
        progress: Math.min(Math.round(totalSaved), 100),
        maxProgress: 100,
        unlockedAt: totalSaved >= 100 ? '已解锁' : undefined
      },
      {
        id: 'ACH_HEALTH_HACK',
        title: '养生极客',
        pixelIcon: '🥗',
        description: '累计特制去酱或换大份甜玉米达到 5 次',
        category: 'special',
        unlocked: healthHacks >= 5,
        progress: Math.min(healthHacks, 5),
        maxProgress: 5,
        unlockedAt: healthHacks >= 5 ? '已解锁' : undefined
      }
    ];

    return achievements;
  }
}
