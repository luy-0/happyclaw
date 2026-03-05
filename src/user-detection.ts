/**
 * User Detection Module (Minimal Version)
 *
 * HappyClaw 以 root 运行，但用户的 ~/.claude/ 在普通用户目录下。
 * 本模块自动检测真实的普通用户 home 目录。
 *
 * 检测策略：
 * 1. SUDO_USER 环境变量
 * 2. 扫描 /home/ 寻找包含 .claude/ 的用户目录
 * 3. 常见用户名猜测（ubuntu, ec2-user, admin）
 * 4. fallback 到当前进程的 home 目录
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { logger } from './logger.js';

let cachedNormalUserHome: string | null = null;

/**
 * 检测系统中真实普通用户的 home 目录。
 * 结果会被缓存，进程生命周期内只检测一次。
 */
export function getNormalUserHome(): string {
  if (cachedNormalUserHome) return cachedNormalUserHome;

  // 策略 1: SUDO_USER 环境变量
  if (process.env.SUDO_USER) {
    const home = `/home/${process.env.SUDO_USER}`;
    if (fs.existsSync(home)) {
      logger.info({ strategy: 'SUDO_USER', home }, '检测到普通用户目录');
      cachedNormalUserHome = home;
      return home;
    }
  }

  // 策略 2: 扫描 /home/ 寻找包含 .claude/ 的用户目录
  try {
    const homeBase = '/home';
    if (fs.existsSync(homeBase)) {
      const entries = fs.readdirSync(homeBase, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const userHome = path.join(homeBase, entry.name);
        const claudeDir = path.join(userHome, '.claude');
        if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
          logger.info({ strategy: 'scan /home/', home: userHome }, '检测到普通用户目录');
          cachedNormalUserHome = userHome;
          return userHome;
        }
      }
    }
  } catch {
    // ignore
  }

  // 策略 3: 常见用户名猜测
  const commonUsernames = ['ubuntu', 'ec2-user', 'admin', 'deploy', 'user'];
  for (const username of commonUsernames) {
    const home = `/home/${username}`;
    if (fs.existsSync(home)) {
      logger.info({ strategy: 'common username', home }, '检测到普通用户目录');
      cachedNormalUserHome = home;
      return home;
    }
  }

  // 策略 4: fallback 到当前进程的 home 目录
  const fallback = os.homedir();
  logger.warn({ strategy: 'fallback', home: fallback }, '未检测到普通用户，使用当前进程 home');
  cachedNormalUserHome = fallback;
  return fallback;
}

/**
 * 获取普通用户的 ~/.claude/ 目录路径
 */
export function getNormalUserClaudeDir(): string {
  return path.join(getNormalUserHome(), '.claude');
}

/**
 * 获取普通用户的 ~/.claude/skills/ 目录路径
 */
export function getNormalUserSkillsDir(): string {
  return path.join(getNormalUserClaudeDir(), 'skills');
}

/**
 * 获取普通用户的 ~/.claude/rules/ 目录路径
 */
export function getNormalUserRulesDir(): string {
  return path.join(getNormalUserClaudeDir(), 'rules');
}
