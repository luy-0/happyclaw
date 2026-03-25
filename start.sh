#!/bin/bash
# HappyClaw 启动脚本
# 用法: ./start.sh [--force]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/data/happyclaw-start.pid"
LOG_FILE="$SCRIPT_DIR/data/happyclaw-start.log"

# 检查是否已有进程在运行
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "HappyClaw 已在运行 (PID: $OLD_PID)"
    if [ "$1" != "--force" ]; then
      echo "如需重启，请使用 --force 参数"
      exit 0
    fi
    echo "强制重启：停止旧进程 $OLD_PID ..."
    kill "$OLD_PID"
    sleep 3
  fi
fi

# 确保 data 目录存在
mkdir -p "$SCRIPT_DIR/data"

# 后台启动
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动 HappyClaw ..." | tee -a "$LOG_FILE"
cd "$SCRIPT_DIR"
nohup npm run start >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

# 等待服务就绪
echo "等待服务启动 (PID: $NEW_PID) ..."
for i in $(seq 1 15); do
  sleep 1
  if ! kill -0 "$NEW_PID" 2>/dev/null; then
    echo "进程意外退出，查看日志: $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
  fi
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|301\|302"; then
    echo "HappyClaw 已就绪 ✓ (PID: $NEW_PID, 端口: 3000)"
    exit 0
  fi
done

echo "服务启动超时，查看日志: $LOG_FILE"
tail -20 "$LOG_FILE"
exit 1
