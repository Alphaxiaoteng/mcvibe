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
   * 将麦当劳官方 MCP order-list 返回的原始订单结构解析为系统 OrderRecord
   */
  public static convertOfficialOrders(officialList: any[]): OrderRecord[] {
    if (!Array.isArray(officialList)) return [];

    return officialList.map((order, index) => {
      const orderId = order.orderId || `MCD-OFFICIAL-${index}`;
      const createTime = order.createTime || new Date().toISOString();
      const dateStr = createTime.includes(' ') ? createTime.split(' ')[0] : createTime.split('T')[0];
      const paid = parseFloat(order.realTotalAmount) || 0;

      const items: any[] = [];
      const productList = order.orderProductList || [];

      for (const prod of productList) {
        if (Array.isArray(prod.comboItemList) && prod.comboItemList.length > 0) {
          for (const sub of prod.comboItemList) {
            const name = sub.name || sub.productName || '经典餐品';
            const cat = this.inferCategory(name);
            items.push({
              id: sub.productCode || `P-${Math.random().toString(36).slice(2, 7)}`,
              name,
              category: cat,
              count: sub.quantity || 1,
              price: Math.max(1, Math.round(paid / (prod.comboItemList.length || 1))),
              calories: this.estimateCalories(cat, name)
            });
          }
        } else {
          const name = prod.productName || '经典餐品';
          const cat = this.inferCategory(name);
          items.push({
            id: prod.productCode || `P-${Math.random().toString(36).slice(2, 7)}`,
            name,
            category: cat,
            count: prod.quantity || 1,
            price: Math.max(1, Math.round(paid / Math.max(1, productList.length))),
            calories: this.estimateCalories(cat, name)
          });
        }
      }

      if (items.length === 0) {
        items.push({
          id: 'P-DEFAULT',
          name: '麦当劳随心配组合',
          category: 'burger',
          count: 1,
          price: paid,
          calories: 480
        });
      }

      const originalTotal = Math.max(paid, items.reduce((s: number, i: any) => s + i.price * i.count, 0));
      const discount = Math.max(0, Number((originalTotal - paid).toFixed(1)));

      return {
        id: orderId,
        timestamp: createTime.includes(' ') ? createTime.replace(' ', 'T') : createTime,
        date: dateStr,
        items,
        totalPrice: originalTotal,
        discountAmount: discount,
        paidAmount: paid,
        couponUsed: discount > 0 ? '官方专享优惠' : undefined,
        pointsEarned: Math.floor(paid * 10),
        diningType: order.beType === '2' ? 'delivery' : 'dine_in',
        storeName: order.storeName || '麦当劳餐厅',
        isOfficialReal: true
      };
    });
  }

  private static inferCategory(name: string): FoodCategory {
    if (/堡|牛|肉|猪|板烧|麦辣鸡腿|麦麦脆汁鸡/.test(name)) return 'burger';
    if (/咖|美式|拿铁|茶|可乐|雪碧|水|饮|果汁|奶/.test(name)) return 'drink';
    if (/派|圆筒|圣代|旋风|雪糕|甜品/.test(name)) return 'dessert';
    if (/早|麦满分|炒蛋|松饼|粥/.test(name)) return 'breakfast';
    if (/薯|薯条|脆薯饼|鸡块|鸡翅|骨|小食/.test(name)) return 'snack';
    return 'burger';
  }

  private static estimateCalories(cat: FoodCategory, name: string): number {
    if (cat === 'burger') return 460;
    if (cat === 'drink') return name.includes('美式') || name.includes('黑咖') || name.includes('零度') ? 15 : 120;
    if (cat === 'snack') return 240;
    if (cat === 'breakfast') return 320;
    if (cat === 'dessert') return 230;
    return 350;
  }

  /**
   * 汇总全景 Vibe 数据
   */
  public static async computeSummary(orders: OrderRecord[], mcpClient: McpClient): Promise<VibeSummary> {
    // 联动查询官方/沙盒 MCP 接口
    let mcpTime: any = {};
    let mcpPoints: any = {};
    let mcpCoupons: any = {};
    let realOrders: OrderRecord[] = [];

    try {
      mcpTime = await mcpClient.callTool('now-time-info');
      mcpPoints = await mcpClient.callTool('query-my-account');
      mcpCoupons = await mcpClient.callTool('query-my-coupons');

      if (!mcpClient.isUsingSandbox()) {
        const mcpOrders = await mcpClient.callTool('order-list');
        if (mcpOrders?.list && Array.isArray(mcpOrders.list)) {
          realOrders = this.convertOfficialOrders(mcpOrders.list);
        }
      }
    } catch {
      // 容错已在 mcpClient 内部处理
    }

    // 将真实官方订单与足迹数据流进行智能合并去重
    let effectiveOrders = orders;
    if (realOrders.length > 0) {
      const mergedMap = new Map<string, OrderRecord>();
      for (const ro of realOrders) {
        mergedMap.set(ro.id, ro);
      }
      for (const o of orders) {
        if (!mergedMap.has(o.id)) {
          mergedMap.set(o.id, o);
        }
      }
      effectiveOrders = Array.from(mergedMap.values());
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = effectiveOrders.filter(o => o.date === todayStr);

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

    const totalOrders = effectiveOrders.length;
    const totalSpent = Number(effectiveOrders.reduce((sum, o) => sum + o.paidAmount, 0).toFixed(1));
    const totalSaved = Number(effectiveOrders.reduce((sum, o) => sum + o.discountAmount, 0).toFixed(1));
    const totalOriginal = Number(effectiveOrders.reduce((sum, o) => sum + o.totalPrice, 0).toFixed(1));
    const savingRate = totalOriginal > 0 ? Number(((totalSaved / totalOriginal) * 100).toFixed(1)) : 0;

    let totalCalories = 0;
    for (const o of effectiveOrders) {
      for (const item of o.items) {
        totalCalories += item.calories * item.count;
      }
    }

    // 计算连续打卡天数
    const uniqueDates = Array.from(new Set(effectiveOrders.map(o => o.date))).sort();
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

    const heatmap = this.generateHeatmap(effectiveOrders, 24);
    const breakdown = this.computeCategoryBreakdown(effectiveOrders);
    const topItems = this.computeTopItems(effectiveOrders);
    const achievements = AchievementEngine.evaluateAchievements(effectiveOrders);

    const isSandbox = mcpClient.isUsingSandbox();
    const userPoints = parseFloat(mcpPoints?.availablePoint ?? mcpPoints?.totalPoints ?? 3420);
    const accumulativePoints = parseFloat(mcpPoints?.accumulativePoint ?? 12890);
    const expiredPoints = parseFloat(mcpPoints?.expiredPoint ?? 0);

    return {
      user: {
        nickname: isSandbox ? 'CyberMaimen' : '麦门开发者',
        avatarPixel: 'pixel-avatar-mcd',
        memberLevel: isSandbox ? (mcpPoints?.tier || 'GOLD_MAIMEN') : '麦享会官方会员',
        points: userPoints,
        accumulativePoints,
        expiredPoints,
        title: isSandbox ? 'Lv.7 麦门黄金架构师' : (userPoints > 100 ? 'Lv.5 麦门极客食客' : 'Lv.3 麦门新锐开发者')
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
        isSandbox,
        tokenConfigured: !!mcpClient.getToken(),
        tokenMasked: mcpClient.getMaskedToken() || undefined,
        timePeriod: mcpTime?.timePeriod || (mcpTime?.dayOfWeek ? 'regular' : 'regular'),
        couponsAvailable: Number(mcpCoupons?.totalCount ?? mcpCoupons?.totalCoupons ?? 5),
        currentTime: mcpTime?.formatted || mcpTime?.datetime || mcpTime?.currentTime || new Date().toISOString(),
        recentStore: realOrders[0]?.storeName || undefined,
        realOrdersCount: realOrders.length
      },
      recentOrders: effectiveOrders.slice(0, 10)
    };
  }
}

