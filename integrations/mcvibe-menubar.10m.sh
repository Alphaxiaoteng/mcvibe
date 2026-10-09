#!/bin/bash
# <xbar.title>McVibe Menu Bar</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Alphaxiaoteng</xbar.author>
# <xbar.desc>Shows McDonald's stats on macOS menu bar</xbar.desc>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.environment>[MCD_MCP_TOKEN: ""]</swiftbar.environment>

# 【配置指南】
# 1. 请将下方的 MCVIBE_DIR 替换为你本地 mcvibe 仓库的实际绝对路径
MCVIBE_DIR="/Users/albert/Documents/project/apps/mcvibe"

# 2. 并在 SwiftBar 偏好设置 -> Environment 中添加 MCD_MCP_TOKEN 环境变量 (填入你的官方 Token)
# 或者直接在这里取消注释并填入 (注意隐私)
# export MCD_MCP_TOKEN="YOUR_TOKEN_HERE"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if [ ! -d "$MCVIBE_DIR" ]; then
  echo "⚠️ McVibe Error | color=red"
  echo "---"
  echo "请在 mcvibe-menubar.10m.sh 脚本中配置正确的仓库路径"
  exit 1
fi

cd "$MCVIBE_DIR" || exit 1
npm run xbar --silent
