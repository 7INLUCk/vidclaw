#!/bin/bash
# 即梦桌面版 - 一键启动脚本
# 用法: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🧹 清理旧进程..."
pkill -f "jimeng-desktop" 2>/dev/null || true
pkill -f "Google Chrome.*jimeng" 2>/dev/null || true
rm -f "$HOME/Library/Application Support/jimeng-desktop/jimeng-profile/SingletonLock" 2>/dev/null || true
sleep 1

echo "🚀 启动 Vite 开发服务器..."
cd "$PROJECT_DIR"
npx vite &
VITE_PID=$!

# 等 Vite 就绪
echo "⏳ 等待 Vite 就绪..."
for i in $(seq 1 20); do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Vite 已就绪 (port 5173)"
    break
  fi
  sleep 0.5
done

echo "🖥️  启动 Electron..."
./node_modules/.bin/electron .

# Electron 关闭后清理
echo "👋 清理..."
kill $VITE_PID 2>/dev/null || true
pkill -f "Google Chrome.*jimeng" 2>/dev/null || true
echo "✅ 已退出"