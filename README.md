# Vibe Guardian 🛡️

> Pre-commit security gate for vibe coding — catches common vulnerabilities in AI-generated code **before** they reach a commit. Hardcoded secrets, SQL/XSS injection, exposed Supabase service_role keys, missing RLS.
> **100% local static rules. No LLM calls. Zero dependencies. Millisecond scans.**

```bash
npx vibe-guardian scan            # scan your project
npx vibe-guardian install-hook    # install the git pre-commit gate
```

Claude Code plugin: `/plugin marketplace add wbw20000/vibe-guardian` → `/plugin install vibe-guardian@vibe-guardian` — then every file Claude writes gets scanned instantly, and Claude fixes issues on the spot.

False positive? Add a `// vibe-guardian: ignore` comment on (or above) the line.

---

> Vibe coding 的预提交安全门禁 — 在代码提交前拦截 AI 生成代码中的常见漏洞。
> **100% 本地静态规则，不调用任何 LLM，零依赖，毫秒级扫描。**

给用 Cursor / Claude Code / Lovable 做 vibe coding 的独立开发者：AI 写代码很快，但硬编码密钥、SQL 注入、裸奔的 Supabase 表也来得很快。Vibe Guardian 在两道关口拦住它们：

1. **写入时**（Claude Code 插件）：AI 每次写文件后立即扫描，发现问题直接让 AI 当场修复
2. **提交时**（git pre-commit 钩子）：带漏洞的代码根本进不了 commit

## 快速开始

```bash
# 扫描当前项目
npx vibe-guardian scan

# 在项目里安装 git pre-commit 钩子
npx vibe-guardian install-hook
```

作为 Claude Code 插件使用：将本仓库添加为 plugin marketplace 后安装 `vibe-guardian`，之后每次 Write/Edit 自动扫描。

## 检测规则

| 类别 | 规则 | 级别 |
|------|------|------|
| 密钥 | AWS / OpenAI / Anthropic / GitHub / Stripe / Google / Slack key、私钥块、通用明文密码赋值、误提交 .env | error |
| 密钥 | JWT 字面量 | warn |
| SQL 注入 | 模板字符串/字符串拼接/Python f-string 拼 SQL | error |
| XSS | innerHTML、dangerouslySetInnerHTML（无消毒）、document.write、insertAdjacentHTML | warn |
| 命令注入 | eval / new Function / exec 拼接变量 | error |
| Supabase | service_role key 出现在客户端代码、NEXT_PUBLIC_ 前缀密钥、建表未启用 RLS | error / warn |
| 配置 | CORS 通配 + credentials | warn |

## 命令

```
vibe-guardian scan [路径...]     扫描文件/目录（默认当前目录）
vibe-guardian scan --staged      只扫描 git 暂存区
vibe-guardian install-hook       安装 pre-commit 钩子
vibe-guardian uninstall-hook     移除 pre-commit 钩子
  --strict                       warning 也视为失败
  --json                         JSON 输出
```

**误报处理**：在该行或上一行加注释 `// vibe-guardian: ignore`。

## 设计原则

- **零依赖、纯本地**：不上传任何代码，不调用任何 API，隐私和速度都有保证
- **error 才拦截**：高置信度规则（密钥、SQL 注入）阻断提交；启发式规则（XSS、RLS）只警告，避免狼来了
- **给 AI 看的报错**：Claude Code 钩子的 block 消息直接告诉 AI 怎么修，形成"写→拦→自动修"闭环

## License

MIT
