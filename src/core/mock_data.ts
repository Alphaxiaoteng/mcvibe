import { OrderRecord, OrderItem, FoodCategory } from './types.js';

export const MCD_MENU_CATALOGUE: Record<string, { name: string; category: FoodCategory; price: number; calories: number }> = {
  'M01': { name: '双层吉士堡', category: 'burger', price: 21.0, calories: 450 },
  'M02': { name: '板烧鸡腿堡', category: 'burger', price: 24.5, calories: 400 },
  'M03': { name: '麦辣鸡腿堡', category: 'burger', price: 22.0, calories: 510 },
  'M04': { name: '巨无霸', category: 'burger', price: 26.0, calories: 530 },
  'M05': { name: '鲜煮美式咖啡', category: 'drink', price: 10.0, calories: 15 },
  'M06': { name: '拿铁咖啡(中)', category: 'drink', price: 15.0, calories: 130 },
  'M07': { name: '可口可乐(中)', category: 'drink', price: 9.5, calories: 150 },
  'M08': { name: '麦辣鸡翅(2块)', category: 'snack', price: 14.5, calories: 230 },
  'M09': { name: '麦乐鸡(5块)', category: 'snack', price: 13.0, calories: 210 },
  'M10': { name: '大份薯条', category: 'snack', price: 15.0, calories: 340 },
  'M11': { name: '甜玉米杯(大)', category: 'snack', price: 12.0, calories: 110 },
  'M12': { name: '猪柳蛋麦满分', category: 'breakfast', price: 16.0, calories: 380 },
  'M13': { name: '吉士蛋麦满分', category: 'breakfast', price: 13.5, calories: 300 },
  'M14': { name: '脆薯饼', category: 'breakfast', price: 7.5, calories: 140 },
  'M15': { name: '香芋派', category: 'dessert', price: 8.5, calories: 220 },
  'M16': { name: '奥利奥麦旋风', category: 'dessert', price: 14.5, calories: 310 }
};

/**
 * 生成过去 24 周（168天）高拟真麦当劳消费历史
 */
export function generateRealisticOrderHistory(): OrderRecord[] {
  const records: OrderRecord[] = [];
  const now = new Date();
  
  // 从 168 天前开始向前模拟
  for (let d = 168; d >= 0; d--) {
    const targetDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 4 is Thursday

    // 吃麦概率模型：
    // 周四吃麦概率 90% (疯狂星期四/会员日)
    // 工作日（周一至周五）早餐/午餐吃麦概率 65%
    // 周末吃麦概率 40%
    const rand = Math.random();
    const threshold = (dayOfWeek === 4) ? 0.92 : ((dayOfWeek >= 1 && dayOfWeek <= 5) ? 0.65 : 0.40);

    if (rand < threshold) {
      // 决定这一天下几单 (通常1单，偶尔2单如早餐+午餐)
      const orderCount = (rand < 0.20 && dayOfWeek >= 1 && dayOfWeek <= 5) ? 2 : 1;

      for (let o = 0; o < orderCount; o++) {
        const orderId = `MCD-${dateStr.replace(/-/g, '')}-${o + 1}`;
        const items: OrderItem[] = [];
        let couponUsed: string | undefined = undefined;
        let discount = 0;

        if (o === 0 && (rand < 0.35 || targetDate.getHours() < 10)) {
          // 早餐订单
          items.push({
            id: 'M12',
            name: MCD_MENU_CATALOGUE['M12'].name,
            category: 'breakfast',
            count: 1,
            price: 16.0,
            calories: 380
          });
          items.push({
            id: 'M05',
            name: MCD_MENU_CATALOGUE['M05'].name,
            category: 'drink',
            count: 1,
            price: 10.0,
            calories: 15
          });
          if (Math.random() < 0.7) {
            couponUsed = '早安咖啡两件套减5元';
            discount = 7.0;
          }
        } else if (dayOfWeek === 4 && rand < 0.8) {
          // 周四狂欢订单
          items.push({
            id: 'M01',
            name: MCD_MENU_CATALOGUE['M01'].name,
            category: 'burger',
            count: 1,
            price: 21.0,
            calories: 450
          });
          items.push({
            id: 'M08',
            name: MCD_MENU_CATALOGUE['M08'].name,
            category: 'snack',
            count: 2,
            price: 14.5,
            calories: 230
          });
          items.push({
            id: 'M07',
            name: MCD_MENU_CATALOGUE['M07'].name,
            category: 'drink',
            count: 1,
            price: 9.5,
            calories: 150
          });
          couponUsed = '麦麦会员周四专享立减15元';
          discount = 15.0;
        } else {
          // 常规工作日/周末正餐（高频：板烧或双吉 + 鲜煮美式/玉米杯）
          const burgerKey = (Math.random() < 0.55) ? 'M02' : 'M01';
          items.push({
            id: burgerKey,
            name: MCD_MENU_CATALOGUE[burgerKey].name,
            category: 'burger',
            count: 1,
            price: MCD_MENU_CATALOGUE[burgerKey].price,
            calories: MCD_MENU_CATALOGUE[burgerKey].calories
          });

          // 配饮
          const drinkKey = (Math.random() < 0.65) ? 'M05' : 'M06';
          items.push({
            id: drinkKey,
            name: MCD_MENU_CATALOGUE[drinkKey].name,
            category: 'drink',
            count: 1,
            price: MCD_MENU_CATALOGUE[drinkKey].price,
            calories: MCD_MENU_CATALOGUE[drinkKey].calories
          });

          // 偶尔加小食
          if (Math.random() < 0.4) {
            const snackKey = (Math.random() < 0.6) ? 'M11' : 'M10';
            items.push({
              id: snackKey,
              name: MCD_MENU_CATALOGUE[snackKey].name,
              category: 'snack',
              count: 1,
              price: MCD_MENU_CATALOGUE[snackKey].price,
              calories: MCD_MENU_CATALOGUE[snackKey].calories
            });
          }

          if (Math.random() < 0.65) {
            couponUsed = '随心配1+1优惠券';
            discount = 8.5;
          }
        }

        const totalPrice = Number(items.reduce((sum, item) => sum + item.price * item.count, 0).toFixed(1));
        const finalDiscount = Math.min(discount, totalPrice - 5);
        const paidAmount = Number((totalPrice - finalDiscount).toFixed(1));
        const pointsEarned = Math.floor(paidAmount * 10);

        records.push({
          id: orderId,
          timestamp: `${dateStr}T12:30:00.000Z`,
          date: dateStr,
          items,
          totalPrice,
          discountAmount: finalDiscount,
          paidAmount,
          couponUsed,
          pointsEarned,
          diningType: Math.random() < 0.7 ? 'dine_in' : 'takeaway'
        });
      }
    }
  }

  // 保证今日有一笔新鲜记录
  const todayStr = now.toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.date === todayStr);
  if (todayRecords.length === 0) {
    records.push({
      id: `MCD-${todayStr.replace(/-/g, '')}-1`,
      timestamp: `${todayStr}T12:15:00.000Z`,
      date: todayStr,
      items: [
        { id: 'M02', name: '板烧鸡腿堡', category: 'burger', count: 1, price: 24.5, calories: 400, customization: '去沙拉酱' },
        { id: 'M05', name: '鲜煮美式咖啡', category: 'drink', count: 1, price: 10.0, calories: 15 },
        { id: 'M11', name: '甜玉米杯(大)', category: 'snack', count: 1, price: 12.0, calories: 110 }
      ],
      totalPrice: 46.5,
      discountAmount: 14.0,
      paidAmount: 32.5,
      couponUsed: '午餐元气随心减14元券',
      pointsEarned: 325,
      diningType: 'dine_in'
    });
  }

  return records;
}
