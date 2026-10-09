import {
  OrderRecord,
  HeatmapDay,
  CategoryBreakdown,
  TopItemChampion,
  VibeSummary,
  FoodCategory
} from './types.js';
import { McpClient } from './mcp_client.js';
import { AchievementEngine } from './achievement_engine.js';

export class VibeAggregator {
  /**
   * 生成过去指定周数（默认 24 周 = 168 天）的热力图方格矩阵
   */
  public static generateHeatmap(orders: OrderRecord[], weeks: number = 24): HeatmapDay[] {
    const totalDays = weeks * 7;
    const now = new Date();
    const days: HeatmapDay[] = [];

    // 建立日期 -> 当日所有订单的映射表
    const ordersByDate = new Map<string, OrderRecord[]>();
    for (const order of orders) {
      if (!ordersByDate.has(order.date)) {
        ordersByDate.set(order.date, []);
      }
      ordersByDate.get(order.date)!.push(order);
    }

    // 从过去 totalDays 天逐日向前遍历到今天
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat

      const dayOrders = ordersByDate.get(dateStr) || [];
      const count = dayOrders.length;
      const totalSpent = Number(dayOrders.reduce((sum, o) => sum + o.paidAmount, 0).toFixed(1));
      const savedAmount = Number(dayOrders.reduce((sum, o) => sum + o.discountAmount, 0).toFixed(1));
      
      let calories = 0;
      const itemHighlights: string[] = [];
      for (const order of dayOrders) {
        for (const item of order.items) {
          calories += item.calories * item.count;
          if (!itemHighlights.includes(item.name)) {
            itemHighlights.push(item.name);
          }
        }
      }

      // 计算像素热力等级 (0 ~ 4)
      let intensity: 0 | 1 | 2 | 3 | 4 = 0;
      if (count > 0) {
        if (totalSpent <= 20) intensity = 1;
        else if (totalSpent <= 38) intensity = 2;
        else if (totalSpent <= 65) intensity = 3;
        else intensity = 4;
      }

      days.push({
        date: dateStr,
        dayOfWeek,
        count,
        intensity,
        totalSpent,
        savedAmount,
        calories,
        itemHighlights: itemHighlights.slice(0, 4)
      });
    }

    return days;
  }

  /**
   * 统计食品分类消耗占比
   */
  public static computeCategoryBreakdown(orders: OrderRecord[]): CategoryBreakdown[] {
    const categoryStats: Record<FoodCategory, { count: number; spent: number }> = {
      burger: { count: 0, spent: 0 },
      drink: { count: 0, spent: 0 },
      snack: { count: 0, spent: 0 },
      breakfast: { count: 0, spent: 0 },
      dessert: { count: 0, spent: 0 }
    };

    let totalSpentAll = 0;

    for (const order of orders) {
      for (const item of order.items) {
        const cat = item.category || 'burger';
        const itemCost = item.price * item.count;
        categoryStats[cat].count += item.count;
        categoryStats[cat].spent += itemCost;
        totalSpentAll += itemCost;
      }
    }

    const categoryMeta: Record<FoodCategory, { label: string; color: string }> = {
      burger: { label: '主食汉堡', color: '#FFC72C' },   // 麦当劳金拱门黄
      drink: { label: '鲜煮咖啡/饮品', color: '#38B2AC' }, // 像素薄荷蓝
      snack: { label: '小食配餐', color: '#ED8936' },   // 炸鸡焦橙
      breakfast: { label: '晨光麦满分', color: '#ECC94B' },// 晨曦蛋黄
      dessert: { label: '甜品派物', color: '#ED64A6' }    // 甜美草莓粉
    };

    return (Object.keys(categoryStats) as FoodCategory[]).map(cat => {
      const spent = Number(categoryStats[cat].spent.toFixed(1));
      const percentage = totalSpentAll > 0 ? Number(((spent / totalSpentAll) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        label: categoryMeta[cat].label,
        count: categoryStats[cat].count,
        spent,
        percentage,
        pixelColor: categoryMeta[cat].color
      };
    }).sort((a, b) => b.spent - a.spent);
  }

  /**
   * 计算 MVP 冠军餐品排行
   */
  public static computeTopItems(orders: OrderRecord[]): TopItemChampion[] {
    const itemMap = new Map<string, { category: FoodCategory; count: number; spent: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        if (!itemMap.has(item.name)) {
          itemMap.set(item.name, { category: item.category, count: 0, spent: 0 });
        }
        const record = itemMap.get(item.name)!;
        record.count += item.count;
        record.spent += item.price * item.count;
      }
    }

    const sorted = Array.from(itemMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const badges = ['👑 麦门最爱', '🥈 忠实搭子', '🥉 续命常客', '🎖️ 随心优选', '✨ 特色尝鲜'];

    return sorted.map(([name, stat], idx) => ({
      name,
      category: stat.category,
      count: stat.count,
      rank: idx + 1,
      totalSpent: Number(stat.spent.toFixed(1)),
      pixelBadge: badges[idx] || '⭐ 麦门印记'
    }));
  }

  /**
   * 汇总全景 Vibe 数据
   */
  public static async computeSummary(orders: OrderRecord[], mcpClient: McpClient): Promise<VibeSummary> {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.date === todayStr);

    const todaySpent = Number(todayOrders.reduce((sum, o) => sum + o.paidAmount, 0).toFixed(1));
    const todaySaved = Number(todayOrders.reduce((sum, o) => sum + o.discountAmount, 0).toFixed(1));
    let todayCalories = 0;
    let coffeeToday = 0;
    let latestMeal = '';

    for (const order of todayOrders) {
      for (const item of order.items) {
        todayCalories += item.calories * item.count;
        if (item.name.includes('咖啡') || item.name.includes('美式')) {
          coffeeToday += item.count;
        }
      }
      latestMeal = order.items.map(i => i.name).join(' + ');
    }

    // 基础 HP (生命/能量值): 满分 100，根据摄入与适量能量动态计算
    const hp = todayOrders.length > 0 ? Math.min(100, Math.max(40, 95 - Math.max(0, todayCalories - 900) / 25)) : 65;
    // 咖啡因/MP (魔法/专注力): 每杯黑咖啡提供 45 点 MP
    const mp = Math.min(100, coffeeToday * 45 + (todayOrders.length > 0 ? 20 : 0));

    const totalOrders = orders.length;
    const totalSpent = Number(orders.reduce((sum, o) => sum + o.paidAmount, 0).toFixed(1));
    const totalSaved = Number(orders.reduce((sum, o) => sum + o.discountAmount, 0).toFixed(1));
    const totalOriginal = Number(orders.reduce((sum, o) => sum + o.totalPrice, 0).toFixed(1));
    const savingRate = totalOriginal > 0 ? Number(((totalSaved / totalOriginal) * 100).toFixed(1)) : 0;
    
    let totalCalories = 0;
    for (const o of orders) {
      for (const item of o.items) {
        totalCalories += item.calories * item.count;
      }
    }

    // 计算连续打卡天数
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
        const diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const isRecentlyActive = uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr);
    currentStreak = isRecentlyActive ? tempStreak : 0;

    // MCP 联动查询
    let mcpTime: any = {};
    let mcpPoints: any = {};
    let mcpCoupons: any = {};
    try {
      mcpTime = await mcpClient.callTool('now-time-info');
      mcpPoints = await mcpClient.callTool('get-user-points');
      mcpCoupons = await mcpClient.callTool('query-user-coupons');
    } catch {
      // 容错已在 mcpClient 内部处理
    }

    const heatmap = this.generateHeatmap(orders, 24);
    const breakdown = this.computeCategoryBreakdown(orders);
    const topItems = this.computeTopItems(orders);
    const achievements = AchievementEngine.evaluateAchievements(orders);

    return {
      user: {
        nickname: 'CyberMaimen',
        avatarPixel: 'pixel-avatar-mcd',
        memberLevel: mcpPoints?.tier || 'GOLD_MAIMEN',
        points: mcpPoints?.totalPoints || 3420,
        title: 'Lv.7 麦门黄金架构师'
      },
      today: {
        spent: todaySpent,
        calories: todayCalories,
        orderCount: todayOrders.length,
        saved: todaySaved,
        hp: Math.round(hp),
        mp: Math.round(mp),
        latestMeal: latestMeal || '板烧鸡腿堡(去酱) + 鲜煮美式咖啡'
      },
      stats: {
        totalOrders,
        totalSpent,
        totalSaved,
        totalCalories,
        currentStreak,
        longestStreak,
        activeDays: uniqueDates.length,
        avgOrderPrice: totalOrders > 0 ? Number((totalSpent / totalOrders).toFixed(1)) : 0,
        savingRatePercent: savingRate
      },
      heatmap,
      breakdown,
      topItems,
      achievements,
      mcpStatus: {
        isConnected: true,
        isSandbox: mcpClient.isUsingSandbox(),
        timePeriod: mcpTime?.timePeriod || 'regular',
        couponsAvailable: mcpCoupons?.totalCoupons || 5,
        currentTime: mcpTime?.currentTime || new Date().toISOString()
      }
    };
  }
}
