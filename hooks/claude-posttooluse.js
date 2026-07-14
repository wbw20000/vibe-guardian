#!/usr/bin/env node
// Claude Code PostToolUse hook: scans files right after Claude writes/edits them.
// Reads the hook event JSON from stdin; if the written file has "error"-level
// findings, returns decision:"block" so Claude sees the problems and fixes them
// immediately — before the code ever reaches a commit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { scanFile, shouldScan } = await import(
  new URL('../src/scanner.js', import.meta.url)
);
const { formatForHook } = await import(new URL('../src/report.js', import.meta.url));

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

let event;
try {
  event = JSON.parse(input);
} catch {
  process.exit(0); // malformed input — never break the user's session
}

const filePath = event?.tool_input?.file_path;
if (!filePath || !fs.existsSync(filePath) || !shouldScan(filePath)) {
  process.exit(0);
}

let findings = [];
try {
  findings = scanFile(filePath);
} catch {
  process.exit(0);
}

const errors = findings.filter((f) => f.severity === 'error');
if (errors.length > 0) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason:
        `Vibe Guardian 在刚写入的文件中发现 ${errors.length} 个安全问题,请立即修复:\n` +
        formatForHook(errors) +
        `\n修复方式: 密钥改用环境变量;SQL 改用参数化查询;确属误报则在该行加注释 "vibe-guardian: ignore"。`,
    })
  );
} else if (findings.length > 0) {
  // Warnings: surface to Claude as context without blocking.
  console.error(`Vibe Guardian warnings:\n${formatForHook(findings)}`);
}
process.exit(0);
