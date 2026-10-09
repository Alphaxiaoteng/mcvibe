# WorkBuddy 智能体使用说明 (workbuddy.md)

本文件记录在腾讯云 WorkBuddy 中配置与使用 **McVibe (麦门足迹)** 的步骤与上下文。

---

## 1. WorkBuddy 连接器配置

在 WorkBuddy 客户端中添加麦当劳官方 MCP 连接器：

```json
{
  "mcpServers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://mcp.mcd.cn",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}
```

---

## 2. 智能体技能定义

在 WorkBuddy 中定义 McVibe 技能：

```yaml
name: mcvibe-copilot
description: 麦当劳生活足迹与个人用量看板助手。通过官方 MCP 查询今日消费与积分卡券，汇总历史热力图与常点单品，支持导出战绩卡片。
tools:
  - mcd-mcp.now-time-info
  - mcd-mcp.get-user-points
  - mcd-mcp.query-user-coupons
  - mcd-mcp.query-menu-list
  - mcd-mcp.query-meal-detail
  - mcd-mcp.auto-bind-coupons
  - mcd-mcp.calculate-price
  - mcd-mcp.create-order
```

---

## 3. 常见对话场景示例

**用户**：
> "帮我看看我最近吃麦当劳的数据，主要点了什么，还有多少积分？"

**助手回复处理流程**：
1. 调用 `mcd-mcp.get-user-points` 获取当前积分为 3,420 点。
2. 调用 `mcd-mcp.query-user-coupons` 获取当前可用券 5 张。
3. 统计历史就餐数据：今年吃得最多的是鲜煮美式咖啡和双层吉士堡，平均客单价 24.5 元，通过优惠券累计节省 800+ 元。
4. 提示用户可以在本地网页版（`http://localhost:3001`）查看完整的 24 周热力图与点阵小票。

---

## 4. 本地复现命令

```bash
cd apps/mcvibe
npm install
npm test
PORT=3001 npm run web
```
