// Vibe Guardian rule definitions.
// Each rule is either line-based (pattern tested per line) or file-based (check
// receives the whole content). Severity "error" blocks the commit; "warn" is
// reported but does not block unless --strict.

const PLACEHOLDER_VALUE =
  /^(\$\{|\$[A-Z_]|process\.env|import\.meta|os\.environ|getenv|ENV\[|<|\{\{|your[-_ ]|my[-_ ]|xxx+|placeholder|example|changeme|change[-_ ]me|dummy|sample|fake|test|todo|fixme|\*+|\.\.\.)/i;

function isPlaceholder(value) {
  return value.length < 8 || PLACEHOLDER_VALUE.test(value);
}

const CLIENT_FILE = /\.(jsx|tsx|vue|svelte)$|(^|[\\/])(app|pages|components|src[\\/]client|public)([\\/]|$)/i;

export const rules = [
  // ---------- Secrets ----------
  {
    id: 'secret-aws-access-key',
    severity: 'error',
    message: 'AWS Access Key ID 硬编码在代码里',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'secret-openai-key',
    severity: 'error',
    message: 'OpenAI API key 硬编码在代码里',
    pattern: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'secret-anthropic-key',
    severity: 'error',
    message: 'Anthropic API key 硬编码在代码里',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'secret-github-token',
    severity: 'error',
    message: 'GitHub token 硬编码在代码里',
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  },
  {
    id: 'secret-stripe-live-key',
    severity: 'error',
    message: 'Stripe live key 硬编码在代码里',
    pattern: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'secret-google-api-key',
    severity: 'error',
    message: 'Google API key 硬编码在代码里',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: 'secret-slack-token',
    severity: 'error',
    message: 'Slack token 硬编码在代码里',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: 'secret-private-key-block',
    severity: 'error',
    message: '私钥文件内容出现在代码里',
    pattern: /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/,
  },
  {
    id: 'secret-jwt-literal',
    severity: 'warn',
    message: 'JWT 字面量硬编码在代码里（若为 Supabase service_role key 则极危险）',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: 'secret-generic-assignment',
    severity: 'error',
    message: '疑似密钥/密码以明文赋值',
    check(content) {
      const findings = [];
      const re =
        /(api[_-]?key|apikey|secret|password|passwd|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["'`]([^"'`\n]+)["'`]/gi;
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(line)) !== null) {
          if (!isPlaceholder(m[2])) {
            findings.push({ line: i + 1, snippet: line.trim() });
          }
        }
      });
      return findings;
    },
  },
  {
    id: 'secret-env-file-committed',
    severity: 'error',
    message: '.env 文件不应提交到仓库（请加入 .gitignore）',
    appliesTo: (p) => /(^|[\\/])\.env(\.local|\.production|\.development)?$/.test(p),
    check() {
      return [{ line: 1, snippet: '(整个文件)' }];
    },
  },

  // ---------- SQL Injection ----------
  {
    id: 'sqli-template-literal',
    severity: 'error',
    message: 'SQL 查询用模板字符串拼接变量（SQL 注入风险），请改用参数化查询',
    pattern: /\.(query|execute|exec|raw|prepare)\s*\(\s*`[^`]*\$\{/,
  },
  {
    id: 'sqli-string-concat',
    severity: 'error',
    message: 'SQL 查询用字符串拼接（SQL 注入风险），请改用参数化查询',
    pattern: /\.(query|execute|exec|raw|prepare)\s*\(\s*["'][^"'\n]*(SELECT|INSERT|UPDATE|DELETE|WHERE)[^"'\n]*["']\s*\+/i,
  },
  {
    id: 'sqli-python-fstring',
    severity: 'error',
    message: 'Python SQL 查询用 f-string/format 拼接（SQL 注入风险），请改用参数化查询',
    appliesTo: (p) => /\.py$/.test(p),
    pattern: /\.(execute|executemany)\s*\(\s*(f["']|["'][^"'\n]*["']\s*(%|\.format\())/,
  },

  // ---------- XSS ----------
  {
    id: 'xss-inner-html',
    severity: 'warn',
    message: 'innerHTML/outerHTML 赋值动态内容可能导致 XSS，考虑 textContent 或消毒库',
    check(content) {
      const findings = [];
      content.split('\n').forEach((line, i) => {
        const m = line.match(/\.(inner|outer)HTML\s*[+]?=\s*(.+)/);
        if (m && !/^\s*["'`][^$]*["'`]\s*;?\s*$/.test(m[2])) {
          findings.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return findings;
    },
  },
  {
    id: 'xss-dangerously-set-inner-html',
    severity: 'warn',
    message: 'dangerouslySetInnerHTML 使用动态内容可能导致 XSS，确认已用 DOMPurify 等消毒',
    check(content) {
      const findings = [];
      content.split('\n').forEach((line, i) => {
        if (
          /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:/.test(line) &&
          !/DOMPurify|sanitize/i.test(line)
        ) {
          findings.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return findings;
    },
  },
  {
    id: 'xss-document-write',
    severity: 'warn',
    message: 'document.write 传入动态内容可能导致 XSS',
    pattern: /document\.write(ln)?\s*\([^)"'`]/,
  },
  {
    id: 'xss-insert-adjacent-html',
    severity: 'warn',
    message: 'insertAdjacentHTML 传入动态内容可能导致 XSS',
    pattern: /\.insertAdjacentHTML\s*\(\s*["'][^"']+["']\s*,\s*[^"'`)]/,
  },
  {
    id: 'danger-eval',
    severity: 'error',
    message: 'eval / new Function 执行动态代码，极易被注入',
    pattern: /\beval\s*\(\s*[^"'`)]|new\s+Function\s*\(\s*[^)]*[^"'`)\s][^)]*\)/,
  },
  {
    id: 'danger-child-process-interp',
    severity: 'error',
    message: 'shell 命令拼接变量（命令注入风险），请用 execFile + 参数数组',
    pattern: /\b(exec|execSync|spawnSync?)\s*\(\s*(`[^`]*\$\{|["'][^"'\n]*["']\s*\+)/,
  },

  // ---------- Supabase ----------
  {
    id: 'supabase-service-role-in-client',
    severity: 'error',
    message: 'service_role key 出现在客户端代码中——它可绕过所有 RLS，泄漏等于数据库全裸',
    appliesTo: (p) => CLIENT_FILE.test(p),
    pattern: /service_role|SERVICE_ROLE/,
  },
  {
    id: 'supabase-public-env-secret',
    severity: 'error',
    message: 'NEXT_PUBLIC_/VITE_ 前缀的环境变量会被打包进前端，不能存放密钥',
    pattern: /\b(NEXT_PUBLIC|VITE|REACT_APP|EXPO_PUBLIC)_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*\b/,
  },
  {
    id: 'supabase-missing-rls',
    severity: 'warn',
    message: 'SQL 迁移创建了表但未启用 RLS（ENABLE ROW LEVEL SECURITY）',
    appliesTo: (p) => /\.sql$/i.test(p),
    check(content) {
      const created = [...content.matchAll(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+\.)?["'`]?(\w+)/gi)].map(
        (m) => m[3].toLowerCase()
      );
      const rlsEnabled = new Set(
        [...content.matchAll(/ALTER\s+TABLE\s+["'`]?(\w+\.)?["'`]?(\w+)["'`]?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map(
          (m) => m[2].toLowerCase()
        )
      );
      return created
        .filter((t) => !rlsEnabled.has(t))
        .map((t) => ({ line: 1, snippet: `表 "${t}" 未启用 RLS` }));
    },
  },

  // ---------- Misc ----------
  {
    id: 'cors-wildcard-credentials',
    severity: 'warn',
    message: 'CORS 同时设置通配 origin 与 credentials，浏览器会拒绝且属危险配置',
    check(content) {
      const findings = [];
      content.split('\n').forEach((line, i) => {
        if (/origin\s*[:=]\s*["'`]\*["'`]/.test(line) && /credentials/i.test(content)) {
          findings.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return findings;
    },
  },
];

export const SUPPRESS_MARKER = /vibe-guardian[:\s-]*(ignore|disable)/i;
