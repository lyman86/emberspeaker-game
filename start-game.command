#!/bin/bash
# 双击启动《烬语者》。需要已安装 Node.js。
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "没有检测到 Node.js。请先到 https://nodejs.org 下载安装 LTS 版本，然后再双击本文件。"
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi
[ -d node_modules ] || npm install || exit 1
npm run dev
