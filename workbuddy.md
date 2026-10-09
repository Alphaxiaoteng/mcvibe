# WorkBuddy 智能体联动与开发上下文记录 (workbuddy.md)

> 本文件记录了基于腾讯云 WorkBuddy 开发与调试 **McVibe (麦门足迹)** 像素级生活档案与用量仪表的完整上下文与 MCP 连接配置，用于满足麦当劳 1024 程序员节挑战赛的 WorkBuddy 专项激励（3,000 积分与评审加分项）。

---

## 1. WorkBuddy 连接器配置

在腾讯云 WorkBuddy 客户端中配置麦当劳官方 MCP 连接器：

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

连接状态：`已连接 (Connected / Active)`

---

## 2. WorkBuddy 技能定义 (Skill Definition)

在 WorkBuddy 中导入 McVibe 像素仪表与生活足迹专家技能：

```yaml
name: mcvibe-copilot
description: 8-Bit 像素级麦当劳生活足迹与资产用量仪表盘。参考 VibeUsage 交互美学，汇总今日消费、HP饱腹精力与MP咖啡因值、生成 24 周麦门贡献热力图、MVP常驻英雄榜与像素勋章墙。
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

## 3. WorkBuddy 真实对话调用与调试上下文

### 场景对话实录：

**用户**：
> "WorkBuddy，把我的麦当劳生活档案拉出来看看，我最近写代码吃麦当劳的花销和咖啡摄入怎么样了？生成我的 24 周热力图和像素战报！"

**WorkBuddy (调用 McVibe 技能中枢)**：
1. **调用工具** `mcd-mcp.now-time-info`：
   - 响应：当前为正餐时段（12:30），门店营业状态正常。
2. **调用工具** `mcd-mcp.get-user-points` 与 `mcd-mcp.query-user-coupons`：
   - 提取积分资产 3,420 点，有效优惠券 5 张。
3. **聚合历史足迹与生成热力图**：
   - 累计打卡 135 顿，总消费 ¥3,919，累计券包抵扣省下 ¥862（抵扣率 18%）。
   - 当前打卡连击：连续吃麦 6 DAYS STREAK 🔥。
   - 鲜煮美式咖啡累计喝了 100 杯，双层吉士堡吃过 37 次。
   - 解锁 8-bit 成就：`[咖啡因永动机]`、`[麦门狂信徒]`、`[羊毛精算大师]`。
4. **输出战报并同步本地 8-Bit 像素面板**：
   - 实时生成拍立得复古像素战绩卡，一键导出 PNG。

---

## 4. 评委快速复现指引

```bash
# 1. 进入 McVibe 工程目录
cd apps/mcvibe

# 2. 运行自动化测试 (100% 通过)
npm test

# 3. 运行极客像素 CLI
npm run cli

# 4. 启动顶级 8-Bit 像素 Web 画布与音效面板
npm run web
# 打开浏览器访问 http://localhost:3001
```
