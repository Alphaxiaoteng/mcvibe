# 麦当劳官方 MCP 协议集成规范 (MCP_INTEGRATION.md)

本项目 **McVibe (麦门足迹)** 深度接入麦当劳官方 Model Context Protocol (MCP) 服务端（`https://mcp.mcd.cn`），实现全天候时段感知、积分与卡券资产体检、餐品微量营养追踪与一键极速重温点餐。

---

## 1. 接入拓扑与协议说明

```
┌────────────────────────────────────────────────────────┐
│               McVibe Client (CLI & Web)                │
└───────────────────────────┬────────────────────────────┘
                            │ JSON-RPC 2.0 / Streamable HTTP
                            ▼
┌────────────────────────────────────────────────────────┐
│           McVibe Core Aggregator & MCP Client          │
└───────────────────────────┬────────────────────────────┘
                            │ Bearer Token / Sandbox Fallback
                            ▼
┌────────────────────────────────────────────────────────┐
│         McDonald's Official MCP (mcp.mcd.cn)           │
│                                                        │
│  • now-time-info        • get-user-points              │
│  • query-user-coupons   • query-menu-list              │
│  • query-meal-detail    • auto-bind-coupons            │
│  • calculate-price      • create-order                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. 核心调用的 8 个官方 MCP 工具

| 工具名称 (Tool Name) | 调用时机 | 业务输入参数 | 核心产出与足迹计算价值 |
| :--- | :--- | :--- | :--- |
| `now-time-info` | 仪表盘启动/定时轮询 | `{}` | 获取当前门店营业状态、判断是否为 10:30 早餐临界点，控制面板时段徽章。 |
| `get-user-points` | 用户资产看板加载 | `{}` | 查询用户当前积分余额（3,420）、临期清零积分（450）及会员等级（GOLD_MAIMEN）。 |
| `query-user-coupons` | 优惠券核销精算 | `{}` | 提取用户卡包内全部可用抵扣券，实时统计可白嫖总资产与临期提醒。 |
| `query-menu-list` | 菜单索引与品类分类 | `{ category?: string }` | 索引全部汉堡、咖啡、小食、早餐元数据，支撑吃麦品类构成计算。 |
| `query-meal-detail` | 餐品热量与营养分析 | `{ mealId: string }` | 查询单品热量（kcal）、蛋白质与脂肪，计算今日精力 HP/MP 槽。 |
| `auto-bind-coupons` | 快速吃麦打卡 | `{ orderAmount: number }` | 自动匹配满减最优券，精算用户本次打卡真实省下的金额。 |
| `calculate-price` | 订单核销结算 | `{ items: CartItem[] }` | 严格校验原价、优惠抵扣与实付金额，防止数据偏差。 |
| `create-order` | 快速重温下单 | `{ items: CartItem[] }` | 生成订单编号与到店取餐号（Pickup Code），实现极速取餐。 |

---

## 3. 环境变量与安全脱敏

本项目严格遵循大赛信息安全红线，严禁硬编码任何真实 Token：

```bash
# 环境变量配置 (可选，留空则自动启用本地高拟真沙盒)
export MCD_MCP_TOKEN="YOUR_MCD_MCP_TOKEN_HERE"
export MCD_MCP_URL="https://mcp.mcd.cn"
```

当未提供 `MCD_MCP_TOKEN` 时，系统自动优雅降级至内建沙盒提供者（`MockProvider`），确保评审官与开发者在离线或无 Token 状态下**开箱即用，100% 体验全部像素交互与完整数据流**。
