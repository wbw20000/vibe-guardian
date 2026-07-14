const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function c(name, text, useColor) {
  return useColor ? COLORS[name] + text + COLORS.reset : text;
}

export function formatFindings(findings, { color = process.stdout.isTTY } = {}) {
  if (findings.length === 0) {
    return c('green', '✔ Vibe Guardian: 未发现安全问题', color);
  }
  const lines = [];
  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');

  for (const f of findings) {
    const badge =
      f.severity === 'error' ? c('red', '✖ ERROR', color) : c('yellow', '⚠ WARN ', color);
    lines.push(`${badge} ${c('bold', `${f.file}:${f.line}`, color)}  [${f.ruleId}]`);
    lines.push(`        ${f.message}`);
    if (f.snippet) lines.push(c('dim', `        > ${f.snippet}`, color));
  }
  lines.push('');
  lines.push(
    `Vibe Guardian: ${c('red', `${errors.length} error(s)`, color)}, ${c('yellow', `${warns.length} warning(s)`, color)}`
  );
  if (errors.length > 0) {
    lines.push(c('dim', '误报？在该行或上一行加注释: // vibe-guardian: ignore', color));
  }
  return lines.join('\n');
}

/** Plain-text summary for Claude Code hook feedback (no ANSI colors). */
export function formatForHook(findings) {
  return findings
    .map((f) => `[${f.severity.toUpperCase()}] ${f.file}:${f.line} ${f.message} — ${f.snippet}`)
    .join('\n');
}
