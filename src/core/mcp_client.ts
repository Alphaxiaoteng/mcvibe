import { MCD_MENU_CATALOGUE } from './mock_data.js';

export interface McpClientOptions {
  token?: string;
  baseUrl?: string;
  forceSandbox?: boolean;
}

export class McpClient {
  private token: string | null;
  private baseUrl: string;
  private isSandbox: boolean;

  constructor(options: McpClientOptions = {}) {
    this.token = options.token || process.env.MCD_MCP_TOKEN || null;
    this.baseUrl = options.baseUrl || process.env.MCD_MCP_URL || 'https://mcp.mcd.cn';
    this.isSandbox = options.forceSandbox ?? !this.token;
  }

  public isUsingSandbox(): boolean {
    return this.isSandbox;
  }

  public setToken(token: string | null): void {
    this.token = token && token.trim().length > 0 ? token.trim() : null;
    this.isSandbox = !this.token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getMaskedToken(): string | null {
    if (!this.token) return null;
    if (this.token.length <= 8) return '****';
    return `${this.token.slice(0, 4)}...${this.token.slice(-4)}`;
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.token) {
      this.isSandbox = true;
      return { success: false, message: '未配置 Token，已切换为本地沙盒模式' };
    }
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'now-time-info',
            arguments: {}
          },
          id: Date.now()
        })
      });
      if (response.ok) {
        this.isSandbox = false;
        return { success: true, message: '成功连接到麦当劳官方 MCP (mcp.mcd.cn)' };
      } else {
        this.isSandbox = true;
        return { success: false, message: `官方接口返回 HTTP ${response.status}，已切回沙盒` };
      }
    } catch (err: any) {
      this.isSandbox = true;
      return { success: false, message: `网络连接失败 (${err.message})，已切回沙盒` };
    }
  }

  public async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (this.isSandbox || !this.token) {
      return this.dispatchMock(toolName, args);
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        console.warn(`[MCP Client] Live endpoint returned ${response.status}, falling back to sandbox`);
        this.isSandbox = true;
        return this.dispatchMock(toolName, args);
      }

      const json = await response.json();
      return json.result || json;
    } catch (err) {
      console.warn(`[MCP Client] Network error to ${this.baseUrl}, falling back to sandbox`);
      this.isSandbox = true;
      return this.dispatchMock(toolName, args);
    }
  }

  private dispatchMock(toolName: string, args: Record<string, any>): any {
    const now = new Date();
    const currentHour = now.getHours();

    switch (toolName) {
      case 'now-time-info':
        return {
          currentTime: now.toISOString(),
          hour: currentHour,
          timePeriod: (currentHour >= 5 && currentHour < 10.5) ? 'breakfast' : 'regular',
          isBreakfastEndingSoon: currentHour === 10 && now.getMinutes() >= 15,
          storeStatus: 'OPEN'
        };

      case 'get-user-points':
        return {
          totalPoints: 3420,
          expiringPoints: 450,
          expireDate: '2026-12-31',
          tier: 'GOLD_MAIMEN',
          lifetimePoints: 12890
        };

      case 'query-user-coupons':
        return {
          totalCoupons: 5,
          coupons: [
            { id: 'CPN_01', title: '午餐元气随心减14元券', discount: 14.0, minSpend: 35.0, expireAt: '2026-10-31' },
            { id: 'CPN_02', title: '随心配1+1超值减8.5元', discount: 8.5, minSpend: 20.0, expireAt: '2026-10-24' },
            { id: 'CPN_03', title: '早安咖啡两件套立减7元', discount: 7.0, minSpend: 18.0, expireAt: '2026-10-15' },
            { id: 'CPN_04', title: '大份薯条买一送一券', discount: 15.0, minSpend: 15.0, expireAt: '2026-10-20' },
            { id: 'CPN_05', title: '周四会员专享立减15元', discount: 15.0, minSpend: 30.0, expireAt: '2026-10-12' }
          ]
        };

      case 'query-menu-list':
        return {
          category: args.category || 'all',
          items: Object.entries(MCD_MENU_CATALOGUE).map(([id, item]) => ({
            id,
            ...item
          }))
        };

      case 'query-meal-detail':
        const item = MCD_MENU_CATALOGUE[args.mealId || 'M01'] || MCD_MENU_CATALOGUE['M01'];
        return {
          id: args.mealId,
          name: item.name,
          category: item.category,
          price: item.price,
          calories: item.calories,
          allergens: ['小麦', '大豆'],
          customizations: ['去沙拉酱', '去酸黄瓜', '少冰', '去冰']
        };

      case 'calculate-price':
        const cartItems: Array<{ price: number; count: number }> = args.items || [];
        const originalTotal = cartItems.reduce((acc, curr) => acc + (curr.price * (curr.count || 1)), 0);
        const discount = Math.min(args.discount || 0, originalTotal);
        return {
          originalPrice: originalTotal,
          discountAmount: discount,
          finalPrice: originalTotal - discount
        };

      case 'create-order':
        return {
          orderId: `MCD-ORDER-${Date.now().toString(36).toUpperCase()}`,
          status: 'SUCCESS_MOCK',
          pickupCode: '88',
          createdAt: now.toISOString()
        };

      default:
        return { success: true, tool: toolName, args };
    }
  }
}
