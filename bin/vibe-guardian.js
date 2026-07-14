#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPath, scanStaged } from '../src/scanner.js';
import { formatFindings } from '../src/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HELP = `Vibe Guardian — vibe coding 预提交安全门禁（纯本地静态规则，不调用 LLM）

用法:
  vibe-guardian scan [路径...]     扫描文件/目录（默认当前目录）
  vibe-guardian scan --staged      只扫描 git 暂存区（pre-commit 用）
  vibe-guardian install-hook       在当前 git 仓库安装 pre-commit 钩子
  vibe-guardian uninstall-hook     移除 pre-commit 钩子

选项:
  --strict    warning 也视为失败（exit 1）
  --json      以 JSON 输出结果
`;

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const strict = args.includes('--strict');
  const json = args.includes('--json');

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return 0;
  }

  if (cmd === 'scan') {
    let findings;
    if (args.includes('--staged')) {
      findings = scanStaged();
    } else {
      const targets = args.slice(1).filter((a) => !a.startsWith('--'));
      if (targets.length === 0) targets.push('.');
      findings = targets.flatMap((t) => scanPath(t));
    }
    if (json) {
      console.log(JSON.stringify(findings, null, 2));
    } else {
      console.log(formatFindings(findings));
    }
    const hasError = findings.some((f) => f.severity === 'error');
    const hasWarn = findings.some((f) => f.severity === 'warn');
    return hasError || (strict && hasWarn) ? 1 : 0;
  }

  if (cmd === 'install-hook') {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      console.error('当前目录不是 git 仓库');
      return 1;
    }
    const hookPath = path.join(gitDir, 'hooks', 'pre-commit');
    const cliPath = path.resolve(__dirname, 'vibe-guardian.js').replace(/\\/g, '/');
    const script = `#!/bin/sh
# Installed by Vibe Guardian
node "${cliPath}" scan --staged || {
  echo ""
  echo "提交被 Vibe Guardian 拦截。修复上述问题后重试,或对误报行添加 'vibe-guardian: ignore' 注释。"
  echo "紧急跳过(不推荐): git commit --no-verify"
  exit 1
}
`;
    if (fs.existsSync(hookPath) && !fs.readFileSync(hookPath, 'utf8').includes('Vibe Guardian')) {
      console.error(`已存在其他 pre-commit 钩子: ${hookPath}\n请手动合并（在其中调用: vibe-guardian scan --staged）`);
      return 1;
    }
    fs.writeFileSync(hookPath, script, { mode: 0o755 });
    console.log(`✔ pre-commit 钩子已安装: ${hookPath}`);
    return 0;
  }

  if (cmd === 'uninstall-hook') {
    const hookPath = path.join(process.cwd(), '.git', 'hooks', 'pre-commit');
    if (fs.existsSync(hookPath) && fs.readFileSync(hookPath, 'utf8').includes('Vibe Guardian')) {
      fs.unlinkSync(hookPath);
      console.log('✔ pre-commit 钩子已移除');
    } else {
      console.log('未发现 Vibe Guardian 安装的钩子');
    }
    return 0;
  }

  console.error(`未知命令: ${cmd}\n`);
  console.log(HELP);
  return 1;
}

process.exit(main());
