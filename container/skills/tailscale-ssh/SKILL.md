# tailscale-ssh

通过 Tailscale 从 Docker 容器或宿主机 SSH 连接到用户的 Mac 电脑，执行远程命令、截图等操作。

触发词：连接 Mac、SSH 到 Mac、远程 Mac、tailscale、/tailscale-ssh。
当用户需要"在 Mac 上执行命令"、"看 Mac 屏幕"、"操作 Mac"时也应触发此 Skill。

## 前提条件（已满足）

- **Tailscale 已预装在 Docker 镜像中**（`/usr/bin/tailscale`、`/usr/sbin/tailscaled`），无需安装
- `tailscaled` 支持 userspace 模式，**不需要 root/sudo 权限**，node 用户可直接运行
- 脚本自动处理 daemon 启动和状态持久化，无需手动干预

## 快速使用（容器内）

辅助脚本位于 `/workspace/project-skills/tailscale-ssh/scripts/ts-connect.sh`，一键完成全流程。
**直接执行即可，不要假设"无法启动"——所有依赖已预装。**

```bash
TS="/workspace/project-skills/tailscale-ssh/scripts/ts-connect.sh"

# 1. 连接（首次会输出认证链接，用户需浏览器确认；后续自动恢复）
bash $TS connect

# 2. 查看状态
bash $TS status

# 3. 在 Mac 上执行命令
bash $TS exec "ls ~/Desktop"

# 4. 截取 Mac 屏幕（保存到工作区）
bash $TS screenshot
# 或指定输出路径
bash $TS screenshot /workspace/group/my-screenshot.png
```

**宿主机模式**：脚本自动检测环境，宿主机上直接使用系统 `tailscale` 命令，无需额外配置。

### 典型工作流

```
用户说"连接 Mac"或"在 Mac 上执行 xxx"
    ↓
运行 ts-connect.sh connect（安装 + 启动 daemon + 加入 Tailnet）
    ↓
首次？→ 输出认证链接，告知用户去浏览器确认 → 确认后重新 connect
已认证？→ 自动连接，输出节点列表
    ↓
运行 ts-connect.sh exec "<命令>"（通过 SSH 执行远程命令）
```

## 输入

- 子命令：`connect`（连接）、`status`（状态）、`exec <命令>`（执行）、`screenshot`（截图）
- 无参数时默认 `status`，未连接则自动 `connect`

## 输出

- connect：连接状态报告（可能需要用户点击认证链接）
- status：Tailscale 网络状态 + Mac 在线状态
- exec：远程命令执行结果
- screenshot：Mac 屏幕截图保存到工作区

## 技术原理（AI 参考）

### Docker 容器模式（主要场景）

容器没有 TUN 设备，脚本自动处理以下步骤：

1. **安装 Tailscale**：`curl -fsSL https://tailscale.com/install.sh | sh`
2. **启动 daemon**：`tailscaled --tun=userspace-networking --statedir=<持久化目录> --socket=/tmp/tailscaled.sock`
3. **加入 Tailnet**：`tailscale --socket=/tmp/tailscaled.sock up --ssh`
4. **状态持久化**：状态文件存储在 `/workspace/group/.local/tailscale-state/`，容器重建后自动恢复认证

所有 tailscale 命令必须带 `--socket=/tmp/tailscaled.sock` 参数。

### Mac 端信息

- **用户名**：`river`
- **SSH 连接**：`ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null river@<MAC_TAILSCALE_IP>`
- **IP 获取**：从 `tailscale status` 输出中查找 Mac 设备行的第一列

### 宿主机模式

脚本通过 `/.dockerenv` 检测环境。宿主机上直接使用系统 `tailscale` 命令，无需 socket 参数。

## 验证

- `ts-connect.sh status` 显示本机和 Mac 均在线
- `ts-connect.sh exec "hostname"` 返回 Mac 主机名

## 边界声明

- 依赖用户的 Mac 已安装 Tailscale 并加入同一 Tailnet
- 依赖 Mac 已开启 SSH（`系统设置 → 通用 → 共享 → 远程登录`）
- screencapture 需要 Mac 授予 sshd 屏幕录制权限
- Docker 容器首次使用需要用户点击认证链接（后续自动恢复）
- Tailscale 状态持久化依赖 `/workspace/group/.local/tailscale-state/` 目录挂载
