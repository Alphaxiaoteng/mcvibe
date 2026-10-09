export type FoodCategory = 'burger' | 'drink' | 'snack' | 'breakfast' | 'dessert';

export interface OrderItem {
  id: string;
  name: string;
  category: FoodCategory;
  count: number;
  price: number;
  calories: number;
  customization?: string;
}

export interface OrderRecord {
  id: string;
  timestamp: string; // ISO 8601
  date: string; // YYYY-MM-DD
  items: OrderItem[];
  totalPrice: number;
  discountAmount: number;
  paidAmount: number;
  couponUsed?: string;
  pointsEarned: number;
  diningType: 'dine_in' | 'takeaway' | 'delivery';
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4; // 0=none, 1=light, 2=medium, 3=high, 4=insane
  totalSpent: number;
  savedAmount: number;
  calories: number;
  itemHighlights: string[];
}

export interface CategoryBreakdown {
  category: FoodCategory;
  label: string;
  count: number;
  spent: number;
  percentage: number;
  pixelColor: string;
}

export interface TopItemChampion {
  name: string;
  category: FoodCategory;
  count: number;
  rank: number;
  totalSpent: number;
  pixelBadge: string;
}

export interface Achievement {
  id: string;
  title: string;
  pixelIcon: string;
  description: string;
  category: 'streak' | 'loyalty' | 'taste' | 'saving' | 'special';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: string;
}

export interface VibeSummary {
  user: {
    nickname: string;
    avatarPixel: string;
    memberLevel: string;
    points: number;
    title: string;
  };
  today: {
    spent: number;
    calories: number;
    orderCount: number;
    saved: number;
    hp: number; // 0-100 (Energy level)
    mp: number; // 0-100 (Caffeine level)
    latestMeal?: string;
  };
  stats: {
    totalOrders: number;
    totalSpent: number;
    totalSaved: number;
    totalCalories: number;
    currentStreak: number;
    longestStreak: number;
    activeDays: number;
    avgOrderPrice: number;
    savingRatePercent: number;
  };
  heatmap: HeatmapDay[];
  breakdown: CategoryBreakdown[];
  topItems: TopItemChampion[];
  achievements: Achievement[];
  mcpStatus: {
    isConnected: boolean;
    isSandbox: boolean;
    timePeriod: string;
    couponsAvailable: number;
    currentTime: string;
  };
}
