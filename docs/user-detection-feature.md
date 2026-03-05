# 用户检测与多用户 Skills/Rules 支持

## 问题背景

HappyClaw 以 root 用户运行时，`os.homedir()` 返回 `/root/`，而用户的元能力库（`.claude/skills/` 和 `.claude/rules/`）位于普通用户目录下（如 `/home/ubuntu/.claude/`）。

这导致 Agent 无法正确加载用户的 Skills 和 Rules。

## 解决方案

新增 `src/user-detection.ts` 模块，自动检测系统中真实普通用户的 home 目录，并支持多用户环境下的 Skills/Rules 扫描和重名处理。

## 功能特性

### 1. 自动检测普通用户 Home 目录

检测策略优先级（从高到低）：

1. **SUDO_USER 环境变量**：通过 sudo 运行时自动设置
2. **系统配置 normalUserHome**：管理员在 Web 设置中显式指定
3. **启发式扫描**：扫描 `/home/` 寻找包含 `.claude/` 的用户目录
4. **常见用户名猜测**：ubuntu, ec2-user, admin, deploy 等
5. **Fallback**：使用当前进程的 home 目录

### 2. 多用户 Skills/Rules 支持

- 自动扫描 `/home/` 下所有包含 `.claude/` 的用户目录
- 收集所有用户的 Skills 和 Rules
- **重名处理**：当多个用户有同名 Skill 时，使用 `{用户名}-{Skill名}` 格式
  - 例如：`ubuntu-eat`、`admin-eat`

### 3. 容器/宿主机模式集成

- **宿主机模式**：自动将所有用户的 Skills/Rules 符号链接到 session 目录
- **容器模式**：挂载检测到的普通用户的 Skills/Rules 目录

## 使其生效

### 方法一：重新编译并重启（推荐）

```bash
cd /home/ubuntu/happyclaw

# 1. 重新编译
npm run build

# 2. 重启 HappyClaw 服务
# 如果使用 systemd：
sudo systemctl restart happyclaw

# 如果使用 pm2：
pm2 restart happyclaw

# 如果手动运行：
# 停止当前进程后重新启动
npm start
```

### 方法二：显式配置 normalUserHome（可选）

如果自动检测不正确，可以在 Web 设置中手动指定：

1. 打开 HappyClaw Web 界面
2. 进入 **设置** → **系统设置**
3. 找到 **normalUserHome** 字段
4. 填入普通用户的 home 目录路径，例如 `/home/ubuntu`
5. 保存设置

或通过环境变量：

```bash
export NORMAL_USER_HOME=/home/ubuntu
```

### 方法三：创建配置文件

直接编辑 `data/config/system-settings.json`：

```json
{
  "normalUserHome": "/home/ubuntu"
}
```

## 验证生效

### 1. 检查日志

重启后查看日志，应看到类似输出：

```
Detected normal user home directory { strategy: 'Scan /home/ for .claude/', home: '/home/ubuntu' }
Discovered users with .claude/ directories { userCount: 1, users: ['ubuntu'] }
```

### 2. 检查 Skills 列表

在 Web 界面的 Skills 页面查看，应能看到 `/home/ubuntu/.claude/skills/` 中的所有 Skills。

### 3. 检查 Session 目录

查看 `data/sessions/main/.claude/skills/` 目录，应有指向用户 Skills 的符号链接：

```bash
ls -la /home/ubuntu/happyclaw/data/sessions/main/.claude/skills/
```

应看到类似：

```
eat -> /home/ubuntu/.claude/skills/eat
vault-distill -> /home/ubuntu/.claude/skills/vault-distill
...
```

### 4. 检查 Rules 目录

```bash
ls -la /home/ubuntu/happyclaw/data/sessions/main/.claude/rules/
```

应看到指向用户 Rules 的符号链接。

## 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/user-detection.ts` | 新增模块：用户检测、多用户扫描、重名处理 |
| `src/container-runner.ts` | 修改 Skills/Rules 挂载和链接逻辑 |
| `src/routes/skills.ts` | 使用新的用户检测函数 |
| `src/routes/mcp-servers.ts` | 使用新的用户检测函数 |
| `src/runtime-config.ts` | 使用新的用户检测函数，添加 normalUserHome 配置 |
| `src/schemas.ts` | 添加 normalUserHome 校验 |

## 技术细节

### 多用户 Skills 重名处理示例

假设系统有两个用户都有 `eat` Skill：

- `/home/ubuntu/.claude/skills/eat/`
- `/home/admin/.claude/skills/eat/`

处理后的链接名称：

- `ubuntu-eat` → `/home/ubuntu/.claude/skills/eat/`
- `admin-eat` → `/home/admin/.claude/skills/eat/`

### 优先级

1. **项目级 Skills**（`container/skills/`）：最低优先级
2. **宿主机用户 Skills**（`/home/*/.claude/skills/`）：中等优先级
3. **HappyClaw 内部安装的 Skills**（`data/skills/{userId}/`）：最高优先级，可覆盖同名

### 注意事项

- Skills/Rules 以**符号链接**形式存在，不会复制文件
- 对原文件的修改会立即反映到 Agent 中（下次启动时生效）
- 多用户重名检测在进程启动时执行，结果会被缓存

## 故障排除

### 问题：Skills 仍然无法加载

1. 检查 `/home/` 下是否存在包含 `.claude/skills/` 的用户目录
2. 检查目录权限，确保 root 可读取普通用户的 `.claude/` 目录
3. 尝试显式配置 `normalUserHome`

### 问题：多用户 Skills 没有按预期合并

1. 检查日志中的 `Discovered users with .claude/ directories` 输出
2. 确认所有用户的 `.claude/` 目录都被扫描到

### 问题：Rules 未生效

1. 确认 Rules 文件扩展名为 `.md`
2. 检查 `data/sessions/{folder}/.claude/rules/` 目录中的符号链接是否正确
