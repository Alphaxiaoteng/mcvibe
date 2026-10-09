# 麦当劳官方 MCP 协议集成说明 (MCP_INTEGRATION.md)

本项目接入麦当劳官方 Model Context Protocol (MCP) 服务端（`https://mcp.mcd.cn`），用于获取营业时段、用户积分、优惠券列表、菜单详情、价格试算及订单生成。

---

## 1. 架构与调用流程

```
┌────────────────────────────────────────────────────────┐
│               McVibe Client (CLI & Web)                │
└───────────────────────────┬────────────────────────────┘
                            │ JSON-RPC 2.0 / Streamable HTTP
                            ▼
┌────────────────────────────────────────────────────────┐
│           McVibe Core Aggregator & MCP Client          │
└───────────────────────────┬────────────────────────────┘
                            │ Bearer Token / 本地沙盒自动降级
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

## 2. 调用的 8 个官方 MCP 工具

| 工具名称 | 调用场景 | 参数 | 核心作用 |
| :--- | :--- | :--- | :--- |
| `now-time-info` | 页面初次加载 / 轮询 | `{}` | 查询门店是否营业，以及当前属于早餐还是正餐时段。 |
| `get-user-points` | 个人资产看板 | `{}` | 查询当前积分余额、即将过期积分与会员等级。 |
| `query-user-coupons` | 卡包资产与试算 | `{}` | 获取当前可用的优惠券列表与满减门槛。 |
| `query-menu-list` | 菜单索引与品类统计 | `{ category?: string }` | 索引汉堡、咖啡、小食、早餐元数据，支撑消费构成计算。 |
| `query-meal-detail` | 餐品营养与特制查询 | `{ mealId: string }` | 查询单品热量、蛋白质和特制选项（如去沙拉酱）。 |
| `auto-bind-coupons` | 吃麦打卡与预订 | `{ orderAmount: number }` | 自动匹配满减最优券，计算本次就餐节省金额。 |
| `calculate-price` | 结算金额校验 | `{ items: CartItem[] }` | 校验原价、优惠券抵扣与实付金额。 |
| `create-order` | 模拟/真实下单 | `{ items: CartItem[] }` | 生成订单编号与到店取餐号（Pickup Code）。 |

---

## 3. 环境变量与安全配置

遵循信息安全规范，配置文件与代码中均不包含真实 Token：

```bash
# 环境变量配置 (可选，留空则自动启用本地沙盒)
export MCD_MCP_TOKEN="YOUR_MCD_MCP_TOKEN_HERE"
export MCD_MCP_URL="https://mcp.mcd.cn"
```

当未提供 `MCD_MCP_TOKEN` 时，系统会自动运行在内建的 Mock 沙盒模式，返回拟真数据，方便在没有 Token 或断网情况下本地调试与运行。
