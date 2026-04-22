# vercel

管理 Vercel 项目：部署、查看日志、管理环境变量、查看项目状态。通过 `npx vercel` CLI 或 REST API 操作。

触发词：vercel、部署到 vercel、vercel 日志、vercel deploy、vercel logs、查看部署状态、域名管理、vercel 环境变量。
当用户提及"部署前端项目"、"查看部署日志"、"配置生产环境变量"、"Vercel 项目管理"时应触发。
即使用户没说 "vercel"，只要涉及 Next.js/前端项目的云端部署管理也应触发。

## 前提条件

- **VERCEL_TOKEN 环境变量**：通过 HappyClaw Web 界面 Settings → 自定义环境变量配置，自动注入所有容器
- **npx**：容器镜像已预装 Node.js + npm，`npx vercel@latest` 即可使用，无需全局安装
- 辅助脚本自动检测环境，**直接执行即可，不要假设"无法使用"**

## 快速使用

辅助脚本路径（按环境自动选择）：
- 容器内：`/workspace/project-skills/vercel/scripts/vercel-helper.sh`
- 容器内（用户级）：`/workspace/user-skills/vercel/scripts/vercel-helper.sh`
- 宿主机：`~/.claude/skills/vercel/scripts/vercel-helper.sh`

```bash
V="/workspace/project-skills/vercel/scripts/vercel-helper.sh"

# 1. 检查连接状态
bash $V check

# 2. 列出所有项目
bash $V ls

# 3. 查看最近部署
bash $V deployments [项目名]

# 4. 查看部署日志
bash $V logs <部署URL或ID>

# 5. 列出环境变量
bash $V env-ls <项目名>

# 6. 查看项目详情
bash $V inspect <部署URL>

# 7. 查看域名
bash $V domains <项目名>

# 8. 调用任意 REST API
bash $V api <endpoint>
# 例如: bash $V api "/v6/deployments?limit=5"
```

### 典型工作流

```
用户说"查看 Vercel 部署状态"或"看看部署日志"
    ↓
运行 vercel-helper.sh check（确认 token 有效）
    ↓
Token 有效 → 执行请求的操作
Token 无效/不存在 → 提示用户在 HappyClaw Web 界面配置 VERCEL_TOKEN
```

### 直接使用 npx vercel（替代脚本）

```bash
# 列出项目
npx vercel@latest ls --token="$VERCEL_TOKEN"

# 查看部署日志
npx vercel@latest logs <deployment-url> --token="$VERCEL_TOKEN"

# 查看环境变量
npx vercel@latest env ls --token="$VERCEL_TOKEN"

# 部署（需在项目目录内）
npx vercel@latest deploy --prod --token="$VERCEL_TOKEN" --yes
```

### 直接使用 REST API（最轻量）

```bash
# 列出项目
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects" | jq '.projects[].name'

# 列出部署
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?limit=10" | jq '.deployments[] | {url, state, created: .created}'

# 查看部署详情
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v13/deployments/<deployment-id>" | jq
```

## 输入

- 子命令：`check`、`ls`、`deployments`、`logs`、`env-ls`、`inspect`、`domains`、`api`
- 无参数时默认 `check`

## 输出

- check：Token 有效性 + 用户信息
- ls：项目列表（名称 + 框架 + 最近更新时间）
- deployments：最近部署列表（URL + 状态 + 时间）
- logs：部署的运行时日志
- env-ls：项目环境变量列表
- inspect：部署详细信息
- domains：项目绑定的域名列表
- api：REST API 原始 JSON 响应

## Token 配置指南（首次使用）

如果 `$VERCEL_TOKEN` 不存在：

1. 登录 [Vercel Token 页面](https://vercel.com/account/tokens) 创建 Token
2. 在 HappyClaw Web 界面 → Settings → Claude 配置 → 自定义环境变量
3. 添加 `VERCEL_TOKEN = <你的token>`
4. 保存后所有新启动的容器自动获得该变量
5. 已运行的容器需要重启（或在当前会话中 `export VERCEL_TOKEN=<token>`）

## 边界声明

- Token 权限取决于创建时选择的 scope（full account 或指定项目）
- 部署操作需要 Token 有写权限
- `npx vercel` 首次运行可能需要几秒下载
- REST API 有速率限制（一般 100 req/min）
