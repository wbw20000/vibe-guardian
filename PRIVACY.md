# Privacy Policy — Vibe Guardian

**TL;DR: Vibe Guardian collects nothing, stores nothing, and sends nothing. Ever.**

Vibe Guardian is a fully local static-analysis tool:

- **No network requests.** The scanner, the git pre-commit hook, and the Claude Code plugin hook run entirely on your machine and never transmit code, findings, metadata, or telemetry anywhere.
- **No LLM calls.** All detection is done with local static rules.
- **No data collection.** There are no analytics, no crash reporting, no usage tracking, no account, and no identifiers.
- **No persistence.** Scan results are printed to your terminal (or returned to Claude Code via stdout) and are not written to disk by the tool.
- **Zero dependencies.** The published npm package has no runtime dependencies, so no third-party package receives your data either.

The only network activity ever involved is the one *you* perform when installing the package from npm or the plugin from GitHub.

If a future version ever changes any of the above, the change will be stated prominently in the README and CHANGELOG, and any such feature will be strictly opt-in.

Questions: open an issue at https://github.com/wbw20000/vibe-guardian/issues

_Last updated: 2026-07-16_
