# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Vibe Guardian — vibe coding 预提交安全门禁。纯本地静态规则（**绝不调用 LLM、绝不引入运行时依赖**）扫描 AI 生成代码中的漏洞：硬编码密钥、SQL/XSS/命令注入、Supabase 配置缺陷。三种分发形态共用同一个扫描引擎：CLI、git pre-commit 钩子、Claude Code 插件（PostToolUse 钩子）。

## 常用命令

```bash
npm test                                  # 运行全部测试 (node:test, 零测试框架依赖)
node --test tests/rules.test.js           # 运行单个测试文件
node bin/vibe-guardian.js scan <path>     # 本地跑 CLI 扫描
node bin/vibe-guardian.js scan --staged   # 扫描 git 暂存区（pre-commit 走这条）
```

注意 Windows 环境：`node --test` 的参数必须是文件 glob（`"tests/*.test.js"`），传目录会 MODULE_NOT_FOUND。

## 架构

数据流：`入口（三选一） → src/scanner.js → src/rules.js → src/report.js`

- **src/rules.js** — 唯一的规则库。每条规则二选一：`pattern`（逐行正则）或 `check(content, path)`（文件级自定义逻辑，返回 `[{line, snippet}]`）。可选 `appliesTo(path)` 限定文件类型（如 Supabase 客户端规则只对 `CLIENT_FILE` 生效，SQL RLS 规则只对 `.sql`）。**severity 语义是产品核心约定：`error` 阻断提交（高置信度规则专用），`warn` 只提示——把启发式规则设成 error 会造成狼来了效应，加新规则时必须想清楚。**
- **src/scanner.js** — 文件遍历 + 过滤（`SCAN_EXTS`/`SKIP_DIRS`/lockfile 排除；`.env` 是特例：无扫描扩展名但必须扫）、行级抑制标记（`vibe-guardian: ignore` 当前行或上一行）、`scanStaged()` 用 `git show :file` 读暂存区内容（不是工作区文件！两者可能不一致）。
- **bin/vibe-guardian.js** — CLI；exit code 1 = 有 error（或 --strict 时有 warn），pre-commit 靠这个 exit code 拦截。
- **hooks/claude-posttooluse.js** — Claude Code PostToolUse 钩子入口。stdin 读事件 JSON，error 级 finding 时 stdout 输出 `{"decision":"block","reason":...}` 让 Claude 当场修复；任何自身异常都必须静默 exit 0（钩子崩溃不能拖垮用户会话）。
- **.claude-plugin/plugin.json + hooks/hooks.json** — 插件清单，matcher 为 `Write|Edit|MultiEdit`。

## 加新规则的流程

1. 在 `src/rules.js` 追加规则对象（先想 severity）
2. 在 `tests/rules.test.js` 同时写"能检出"和"合法代码不误报"两个断言——误报测试与检出测试同等重要，placeholder/env-var 排除逻辑（`isPlaceholder`）依赖它们守护
3. `npm test` 全绿后，用真实漏洞样例跑一遍 `node bin/vibe-guardian.js scan` 目测输出

## 约束

- 保持零 npm 依赖（`package.json` 无 dependencies），Node >= 18，ESM（`"type": "module"`）
- 所有用户可见文案用中文；规则 message 要直接告诉用户怎么修
- 报告分两套格式：`formatFindings`（终端，带 ANSI 色）和 `formatForHook`（给 Claude 看的纯文本），改输出时两处都要看
