# HappyClaw 分支管理策略

## 远端仓库配置

| 远端名称 | 仓库地址 | 用途 |
|---------|---------|------|
| `origin` | `git@github.com:luy-0/happyclaw.git` | 个人 fork 仓库 |
| `upstream` | `git@github.com:riba2534/happyclaw.git` | 上游原始仓库 |

## 分支结构

### main 分支（纯净同步分支）

- **定位**：与 upstream/main 保持完全一致，不包含个人定制
- **同步方式**：
  ```bash
  git fetch upstream
  git checkout main
  git merge --ff-only upstream/main
  git push origin main --force-with-lease
  ```
- **约束**：
  - MUST NOT：在 main 分支上进行任何个人开发
  - MUST NOT：向 main 分支提交个人定制内容
  - MUST：定期同步 upstream/main 的变更

### working 分支（日常运行分支）

- **定位**：实际运行环境使用的分支，包含个人定制
- **个人定制包括**：
  - 提示音功能（notification sound）
  - 环境变量配置
  - 其他运行时优化
- **更新方式**：
  - 从 main 分支合并上游变更
  - 如有冲突，迁移到 test 分支处理
- **约束**：
  - MUST：保持稳定可运行状态
  - SHOULD：定期从 main 分支合并上游变更

### test 分支（冲突解决分支）

- **定位**：专门用于处理合并冲突和测试新功能
- **使用场景**：
  1. main → working 合并时出现冲突
  2. 功能分支 → working 合并时出现冲突
  3. 大型变更的预验证
- **工作流程**：
  ```bash
  git checkout test
  git merge <source-branch>  # 解决冲突
  git add <resolved-files>
  git commit
  # 测试验证...
  git checkout working
  git merge test  # 快进合并或创建合并提交
  ```
- **约束**：
  - MUST：所有冲突在 test 分支解决
  - MUST：解决冲突后进行充分测试
  - SHOULD：test 分支稳定后合并到 working

### 功能分支（feat/xxx）

- **定位**：开发新功能或修复问题
- **命名规则**：
  - 新功能：`feat/<功能描述>`
  - 修复：`fix/<问题描述>`
  - 重构：`refactor/<范围>`
- **生命周期**：
  ```bash
  # 创建功能分支
  git checkout -b feat/new-feature working

  # 开发、测试...
  git add <files>
  git commit -m "功能: 实现 XXX"

  # 合并到 working（无冲突）
  git checkout working
  git merge feat/new-feature

  # 合并到 working（有冲突）
  git checkout test
  git merge feat/new-feature  # 解决冲突
  git checkout working
  git merge test

  # 清理功能分支
  git branch -d feat/new-feature
  git push origin :feat/new-feature  # 删除远端分支（可选）
  ```
- **约束**：
  - MUST：从 working 分支切出功能分支
  - MUST：功能完成并测试通过后才能合并
  - SHOULD：合并后删除本地和远端功能分支

## 上游变更同步流程

### 场景 1：无冲突快进合并

```bash
# 1. 同步 upstream → main
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main

# 2. 同步 main → working
git checkout working
git merge main
git push origin working
```

### 场景 2：有冲突需要处理

```bash
# 1. 同步 upstream → main
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main

# 2. 尝试合并到 working
git checkout working
git merge main  # 如果有冲突，中止合并

# 3. 在 test 分支解决冲突
git merge --abort
git checkout test
git merge main
# 解决冲突...
git add <resolved-files>
git commit -m "合并: 同步上游变更到 test 分支，解决冲突"

# 4. 测试验证后合并到 working
git checkout working
git merge test
git push origin working test
```

## 冲突解决策略

### 冲突类型判断

| 冲突类型 | 处理策略 |
|---------|---------|
| 上游优化 vs 个人定制 | 保留个人定制，手动应用上游优化 |
| 上游重构 vs 个人改动 | 优先采纳上游重构，迁移个人改动到新结构 |
| 上游新功能 vs 个人实现 | 评估后选择更优方案 |

### 冲突解决原则

1. **保留个人核心定制**：提示音、环境配置等运行时必需功能
2. **采纳上游架构变更**：框架升级、依赖更新、重构改进
3. **合并互补功能**：上游和个人功能互不冲突时保留双方
4. **记录决策理由**：在提交信息中说明冲突解决的依据

### 示例：Switch 组件冲突

```typescript
// 冲突前（个人定制）
import { Switch } from '@/components/ui/switch';  // 自定义组件
<Switch checked={...} onCheckedChange={...} />

// 冲突前（上游变更）
import * as Switch from '@radix-ui/react-switch';  // 原生组件
<Switch.Root ... ><Switch.Thumb /></Switch.Root>

// 解决策略：保留个人定制
// 理由：working 分支已对 Switch 组件做了定制化封装
import { Switch } from '@/components/ui/switch';
<Switch checked={...} onCheckedChange={...} />
```

## Git 配置

### SSH 配置

```bash
# 使用 ubuntu 用户的 SSH 密钥
GIT_SSH_COMMAND='ssh -i /home/ubuntu/.ssh/id_ed25519_github -o IdentitiesOnly=yes' git push origin <branch>
```

### 提交规范

- 提交信息使用简体中文
- 格式：`类型: 简要描述`
- 包含 Co-Authored-By 标识 AI 协作

## 常见操作

### 创建新功能分支

```bash
git checkout working
git pull origin working
git checkout -b feat/new-feature
```

### 功能开发完成后合并

```bash
# 无冲突
git checkout working
git merge feat/new-feature
git push origin working

# 有冲突
git checkout test
git merge feat/new-feature
# 解决冲突...
git checkout working
git merge test
git push origin working test
```

### 放弃功能分支

```bash
git checkout working
git branch -D feat/abandoned-feature
git push origin :feat/abandoned-feature  # 删除远端（如果已推送）
```

### 查看分支状态

```bash
# 查看所有分支
git branch -a

# 查看分支差异
git log main..working  # working 领先 main 的提交
git log working..main  # main 领先 working 的提交

# 查看待合并的提交
git log --oneline --graph --all
```

## 注意事项

1. **MUST NOT**：直接推送到 upstream（无权限）
2. **MUST NOT**：在 main 分支提交个人定制
3. **MUST**：功能分支在合并前充分测试
4. **MUST**：解决冲突后在 commit message 中说明决策依据
5. **SHOULD**：定期同步上游变更，避免积累大量冲突
6. **SHOULD**：功能分支合并后及时清理

## 分支保护

- **main**：禁止 force push（除非从 upstream 同步）
- **working**：谨慎 force push（仅在明确需要时）
- **test**：可以 force push（冲突解决过程中）
- **feat/xxx**：可以 force push（开发过程中）
