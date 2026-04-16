#!/bin/bash
# Tailscale 容器快速连接脚本
# 用法: ts-connect.sh [connect|status|exec <cmd>|screenshot]
set -euo pipefail

# === 环境检测 ===
if [ -f /.dockerenv ]; then
  MODE="container"
  TS_SOCKET="/tmp/tailscaled.sock"
  TS_STATE="/workspace/group/.local/tailscale-state"
  TS_CMD="tailscale --socket=$TS_SOCKET"
else
  MODE="host"
  TS_SOCKET=""
  TS_STATE=""
  TS_CMD="tailscale"
fi

ACTION="${1:-status}"
shift 2>/dev/null || true

# === 确保 tailscale 已安装（镜像预装，此处仅做检查）===
ensure_installed() {
  export PATH="/usr/sbin:/usr/bin:$HOME/bin:$PATH"
  if command -v tailscale &>/dev/null; then
    return 0
  fi
  echo "❌ Tailscale 未安装。请重建容器镜像（make build-container）"
  exit 1
}

# === 确保 tailscaled 运行中（仅容器模式）===
ensure_daemon() {
  if [ "$MODE" != "container" ]; then
    return 0
  fi
  mkdir -p "$TS_STATE"
  if pgrep -f "tailscaled.*userspace" >/dev/null 2>&1; then
    return 0
  fi
  echo "🔄 启动 tailscaled（userspace 模式）..."
  tailscaled --tun=userspace-networking \
    --statedir="$TS_STATE" \
    --socket="$TS_SOCKET" \
    --no-logs-no-support &
  sleep 2
  echo "✅ tailscaled 已启动"
}

# === 加入 Tailnet ===
ensure_connected() {
  local status_output
  status_output=$($TS_CMD status 2>&1) || true

  if echo "$status_output" | grep -qE "Logged out|NeedsLogin|failed to connect"; then
    echo "🔑 需要认证，正在生成链接..."
    $TS_CMD up --ssh 2>&1
    echo ""
    echo "⬆️  请在浏览器打开上面的链接完成认证"
    echo "认证完成后重新运行此脚本"
    exit 0
  fi
  echo "✅ Tailscale 已连接"
}

# === 查找 Mac ===
find_mac() {
  local status_output
  status_output=$($TS_CMD status 2>&1)
  # 输出所有对端节点
  echo "$status_output" | grep -v "^#" | grep -v "^$"
}

# === 主逻辑 ===
case "$ACTION" in
  connect)
    ensure_installed
    ensure_daemon
    ensure_connected
    echo ""
    echo "📡 Tailnet 节点列表："
    find_mac
    ;;
  status)
    ensure_installed
    ensure_daemon
    echo "📡 Tailscale 状态："
    $TS_CMD status 2>&1 || echo "未连接"
    ;;
  exec)
    CMD="$*"
    if [ -z "$CMD" ]; then
      echo "用法: ts-connect.sh exec <命令>"
      exit 1
    fi
    MAC_IP=$($TS_CMD status 2>&1 | grep -i "macos\|macbook\|river" | awk '{print $1}' | head -1)
    if [ -z "$MAC_IP" ]; then
      echo "❌ 未找到 Mac 节点，请先运行: ts-connect.sh connect"
      exit 1
    fi
    echo "🖥️  在 Mac ($MAC_IP) 上执行: $CMD"
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "river@$MAC_IP" "$CMD"
    ;;
  screenshot)
    MAC_IP=$($TS_CMD status 2>&1 | grep -i "macos\|macbook\|river" | awk '{print $1}' | head -1)
    if [ -z "$MAC_IP" ]; then
      echo "❌ 未找到 Mac 节点"
      exit 1
    fi
    OUTFILE="${1:-/workspace/group/mac-screenshot.png}"
    echo "📸 截取 Mac 屏幕..."
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "river@$MAC_IP" "screencapture -x /tmp/screen.png"
    scp -o StrictHostKeyChecking=no "river@$MAC_IP:/tmp/screen.png" "$OUTFILE"
    echo "✅ 截图已保存: $OUTFILE"
    ;;
  *)
    echo "用法: ts-connect.sh [connect|status|exec <命令>|screenshot [输出路径]]"
    exit 1
    ;;
esac
