/**
 * User Detection Module
 *
 * HappyClaw 可能以 root 运行，但用户的元能力库（~/.claude/）在普通用户目录下。
 * 本模块自动检测真实的普通用户 home 目录，使 Agent 能够正确加载 skills 和 rules。
 *
 * 检测策略优先级：
 * 1. SUDO_USER 环境变量（通过 sudo 运行时自动设置）
 * 2. 系统设置中的 normalUserHome 配置（管理员显式指定）
 * 3. 启发式扫描 /home/ 寻找包含 .claude/ 的用户目录
 * 4. 常见用户名猜测（ubuntu, ec2-user, admin 等）
 * 5. fallback 到当前进程的 home 目录
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { logger } from './logger.js';

// Lazy import to avoid circular dependency with runtime-config
let getSystemSettingsFn: (() => { normalUserHome?: string }) | null = null;

function getSystemSettings(): { normalUserHome?: string } {
  if (!getSystemSettingsFn) {
    try {
      // Dynamic import to break circular dependency
      const mod = require('./runtime-config.js');
      getSystemSettingsFn = mod.getSystemSettings;
    } catch {
      return {};
    }
  }
  try {
    return getSystemSettingsFn ? getSystemSettingsFn() : {};
  } catch {
    return {};
  }
}

let cachedNormalUserHome: string | null = null;

/**
 * 检测系统中真实普通用户的 home 目录。
 * 结果会被缓存，进程生命周期内只检测一次。
 */
export function getNormalUserHome(): string {
  if (cachedNormalUserHome) return cachedNormalUserHome;

  const strategies: Array<{ name: string; fn: () => string | null }> = [
    {
      name: 'SUDO_USER',
      fn: () => {
        if (process.env.SUDO_USER) {
          const home = `/home/${process.env.SUDO_USER}`;
          if (fs.existsSync(home)) return home;
        }
        return null;
      },
    },
    {
      name: 'SystemSettings.normalUserHome',
      fn: () => {
        const settings = getSystemSettings();
        if (settings.normalUserHome && fs.existsSync(settings.normalUserHome)) {
          return settings.normalUserHome;
        }
        return null;
      },
    },
    {
      name: 'Scan /home/ for .claude/',
      fn: () => {
        try {
          const homeBase = '/home';
          if (!fs.existsSync(homeBase)) return null;

          for (const user of fs.readdirSync(homeBase)) {
            const userHome = path.join(homeBase, user);
            const claudeDir = path.join(userHome, '.claude');
            try {
              if (
                fs.existsSync(claudeDir) &&
                fs.statSync(claudeDir).isDirectory()
              ) {
                return userHome;
              }
            } catch {
              continue;
            }
          }
        } catch {
          // ignore
        }
        return null;
      },
    },
    {
      name: 'Common usernames',
      fn: () => {
        for (const user of [
          'ubuntu',
          'ec2-user',
          'admin',
          'deploy',
          'node',
          'user',
        ]) {
          const home = `/home/${user}`;
          if (fs.existsSync(home)) return home;
        }
        return null;
      },
    },
  ];

  for (const strategy of strategies) {
    const result = strategy.fn();
    if (result) {
      cachedNormalUserHome = result;
      logger.info(
        { strategy: strategy.name, home: result },
        'Detected normal user home directory',
      );
      return result;
    }
  }

  // Fallback to current process home
  cachedNormalUserHome = os.homedir();
  logger.warn(
    { fallback: cachedNormalUserHome },
    'Could not detect normal user home, using process home directory',
  );
  return cachedNormalUserHome;
}

/**
 * 获取普通用户的 .claude/ 目录路径
 */
export function getNormalUserClaudeDir(): string {
  return path.join(getNormalUserHome(), '.claude');
}

/**
 * 获取普通用户的 skills 目录路径（~/.claude/skills/）
 */
export function getNormalUserSkillsDir(): string {
  return path.join(getNormalUserClaudeDir(), 'skills');
}

/**
 * 获取普通用户的 rules 目录路径（~/.claude/rules/）
 */
export function getNormalUserRulesDir(): string {
  return path.join(getNormalUserClaudeDir(), 'rules');
}

/**
 * 获取普通用户的 agents 目录路径（~/.claude/agents/）
 */
export function getNormalUserAgentsDir(): string {
  return path.join(getNormalUserClaudeDir(), 'agents');
}

/**
 * 检查当前进程是否以 root 运行
 */
export function isRunningAsRoot(): boolean {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

/**
 * 重置缓存（仅用于测试）
 */
export function resetCache(): void {
  cachedNormalUserHome = null;
  cachedAllUsersWithClaude = null;
}

// ============================================================
// 多用户支持：扫描 /home/ 下所有包含 .claude/ 的用户
// ============================================================

export interface UserClaudeInfo {
  username: string;
  home: string;
  claudeDir: string;
  skillsDir: string;
  rulesDir: string;
}

let cachedAllUsersWithClaude: UserClaudeInfo[] | null = null;

/**
 * 获取所有包含 .claude/ 目录的用户信息。
 * 结果会被缓存，进程生命周期内只扫描一次。
 */
export function getAllUsersWithClaude(): UserClaudeInfo[] {
  if (cachedAllUsersWithClaude) return cachedAllUsersWithClaude;

  const users: UserClaudeInfo[] = [];

  try {
    const homeBase = '/home';
    if (!fs.existsSync(homeBase)) {
      cachedAllUsersWithClaude = users;
      return users;
    }

    for (const username of fs.readdirSync(homeBase)) {
      const userHome = path.join(homeBase, username);
      const claudeDir = path.join(userHome, '.claude');

      try {
        if (
          fs.existsSync(claudeDir) &&
          fs.statSync(claudeDir).isDirectory()
        ) {
          users.push({
            username,
            home: userHome,
            claudeDir,
            skillsDir: path.join(claudeDir, 'skills'),
            rulesDir: path.join(claudeDir, 'rules'),
          });
        }
      } catch {
        continue;
      }
    }

    logger.info(
      { userCount: users.length, users: users.map((u) => u.username) },
      'Discovered users with .claude/ directories',
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to scan /home/ for .claude directories');
  }

  cachedAllUsersWithClaude = users;
  return users;
}

export interface SkillSource {
  /** 原始 skill 名称 */
  name: string;
  /** 来源用户名 */
  username: string;
  /** 完整路径 */
  path: string;
  /** 链接名称（可能是 "skillname" 或 "username-skillname"） */
  linkName: string;
}

/**
 * 收集所有用户的 skills，处理重名冲突。
 * 返回一个数组，每个元素包含 skill 信息和建议的链接名称。
 * 如果多个用户有同名 skill，链接名称会变成 "{username}-{skillname}"。
 */
export function collectAllUserSkills(): SkillSource[] {
  const users = getAllUsersWithClaude();
  const skillsByName = new Map<string, SkillSource[]>();

  // 第一遍：收集所有 skills
  for (const user of users) {
    if (!fs.existsSync(user.skillsDir)) continue;

    try {
      for (const entry of fs.readdirSync(user.skillsDir, {
        withFileTypes: true,
      })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

        const skillPath = path.join(user.skillsDir, entry.name);
        const source: SkillSource = {
          name: entry.name,
          username: user.username,
          path: skillPath,
          linkName: entry.name, // 默认使用原名
        };

        const existing = skillsByName.get(entry.name);
        if (existing) {
          existing.push(source);
        } else {
          skillsByName.set(entry.name, [source]);
        }
      }
    } catch {
      continue;
    }
  }

  // 第二遍：处理重名冲突
  const result: SkillSource[] = [];
  for (const [name, sources] of skillsByName) {
    if (sources.length === 1) {
      // 无冲突，使用原名
      result.push(sources[0]);
    } else {
      // 有冲突，使用 "{username}-{skillname}" 格式
      for (const source of sources) {
        source.linkName = `${source.username}-${source.name}`;
        result.push(source);
      }
      logger.debug(
        { skillName: name, users: sources.map((s) => s.username) },
        'Skill name conflict detected, using prefixed names',
      );
    }
  }

  return result;
}

export interface RuleSource {
  /** 原始 rule 文件名 */
  name: string;
  /** 来源用户名 */
  username: string;
  /** 完整路径 */
  path: string;
  /** 链接名称（可能是 "rule.md" 或 "username-rule.md"） */
  linkName: string;
}

/**
 * 收集所有用户的 rules，处理重名冲突。
 * 返回一个数组，每个元素包含 rule 信息和建议的链接名称。
 * 如果多个用户有同名 rule，链接名称会变成 "{username}-{rulename}"。
 */
export function collectAllUserRules(): RuleSource[] {
  const users = getAllUsersWithClaude();
  const rulesByName = new Map<string, RuleSource[]>();

  // 第一遍：收集所有 rules
  for (const user of users) {
    if (!fs.existsSync(user.rulesDir)) continue;

    try {
      for (const entry of fs.readdirSync(user.rulesDir, {
        withFileTypes: true,
      })) {
        if (!entry.isFile() && !entry.isSymbolicLink()) continue;
        if (!entry.name.endsWith('.md')) continue;

        const rulePath = path.join(user.rulesDir, entry.name);
        const source: RuleSource = {
          name: entry.name,
          username: user.username,
          path: rulePath,
          linkName: entry.name, // 默认使用原名
        };

        const existing = rulesByName.get(entry.name);
        if (existing) {
          existing.push(source);
        } else {
          rulesByName.set(entry.name, [source]);
        }
      }
    } catch {
      continue;
    }
  }

  // 第二遍：处理重名冲突
  const result: RuleSource[] = [];
  for (const [name, sources] of rulesByName) {
    if (sources.length === 1) {
      // 无冲突，使用原名
      result.push(sources[0]);
    } else {
      // 有冲突，使用 "{username}-{rulename}" 格式
      // 例如 "ai-dev-testing.md" → "ubuntu-ai-dev-testing.md"
      for (const source of sources) {
        const baseName = source.name.replace(/\.md$/, '');
        source.linkName = `${source.username}-${baseName}.md`;
        result.push(source);
      }
      logger.debug(
        { ruleName: name, users: sources.map((s) => s.username) },
        'Rule name conflict detected, using prefixed names',
      );
    }
  }

  return result;
}
