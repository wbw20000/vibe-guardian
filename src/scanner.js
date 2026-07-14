import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rules, SUPPRESS_MARKER } from './rules.js';

const SCAN_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
  '.py', '.rb', '.go', '.java', '.php', '.cs',
  '.sql', '.html', '.htm', '.yml', '.yaml', '.json', '.toml', '.sh', '.ps1',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', 'vendor', '__pycache__', '.venv', 'venv',
]);

const SKIP_FILES = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css))$/;

export function shouldScan(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILES.test(base)) return false;
  if (/^\.env(\.|$)/.test(base) && !/\.(example|sample|template)$/.test(base)) return true;
  return SCAN_EXTS.has(path.extname(filePath).toLowerCase());
}

/** Scan a string of content. Returns an array of findings. */
export function scanContent(content, filePath = '<stdin>') {
  const findings = [];
  const lines = content.split('\n');

  const suppressed = (lineNo) => {
    const cur = lines[lineNo - 1] ?? '';
    const prev = lines[lineNo - 2] ?? '';
    return SUPPRESS_MARKER.test(cur) || SUPPRESS_MARKER.test(prev);
  };

  for (const rule of rules) {
    if (rule.appliesTo && !rule.appliesTo(filePath)) continue;

    if (rule.pattern) {
      lines.forEach((line, i) => {
        if (rule.pattern.test(line) && !suppressed(i + 1)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            file: filePath,
            line: i + 1,
            snippet: line.trim().slice(0, 160),
          });
        }
      });
    } else if (rule.check) {
      for (const hit of rule.check(content, filePath)) {
        if (!suppressed(hit.line)) {
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            file: filePath,
            line: hit.line,
            snippet: (hit.snippet ?? '').slice(0, 160),
          });
        }
      }
    }
  }
  return findings;
}

export function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return scanContent(content, filePath);
}

/** Recursively scan a path (file or directory). */
export function scanPath(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return shouldScan(target) ? scanFile(target) : [];
  }
  const findings = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        findings.push(...scanPath(path.join(target, entry.name)));
      }
    } else if (shouldScan(entry.name)) {
      findings.push(...scanFile(path.join(target, entry.name)));
    }
  }
  return findings;
}

/** Scan the staged (index) version of files about to be committed. */
export function scanStaged(cwd = process.cwd()) {
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
    { cwd, encoding: 'utf8' }
  );
  const files = out.split('\n').filter(Boolean);
  const findings = [];
  for (const file of files) {
    if (!shouldScan(file)) continue;
    let content;
    try {
      content = execFileSync('git', ['show', `:${file}`], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      continue; // binary or unreadable — skip
    }
    findings.push(...scanContent(content, file));
  }
  return findings;
}
