import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanContent, shouldScan } from '../src/scanner.js';

function ids(findings) {
  return findings.map((f) => f.ruleId);
}

// ---------- Secrets ----------

test('detects hardcoded AWS access key', () => {
  const f = scanContent('const key = "AKIAIOSFODNN7EXAMPLE";', 'a.js');
  assert.ok(ids(f).includes('secret-aws-access-key'));
});

test('detects OpenAI and Anthropic keys', () => {
  const f = scanContent(
    'const a = "sk-proj-abcdefghij1234567890abcd";\nconst b = "sk-ant-api03-abcdefghij1234567890";',
    'a.js'
  );
  assert.ok(ids(f).includes('secret-openai-key'));
  assert.ok(ids(f).includes('secret-anthropic-key'));
});

test('detects generic secret assignment but ignores env vars and placeholders', () => {
  const bad = scanContent('const password = "hunter2secret99";', 'a.js');
  assert.ok(ids(bad).includes('secret-generic-assignment'));

  const ok = scanContent(
    [
      'const password = process.env.DB_PASSWORD;',
      'const apiKey = "your-api-key-here";',
      'const secret = "${SECRET}";',
      'const token = "changeme";',
    ].join('\n'),
    'a.js'
  );
  assert.equal(ids(ok).filter((i) => i === 'secret-generic-assignment').length, 0);
});

test('detects private key block and .env file', () => {
  const f = scanContent('-----BEGIN RSA PRIVATE KEY-----', 'a.js');
  assert.ok(ids(f).includes('secret-private-key-block'));

  const env = scanContent('DB_PASSWORD=x', '.env');
  assert.ok(ids(env).includes('secret-env-file-committed'));
});

// ---------- SQL Injection ----------

test('detects SQL template-literal interpolation', () => {
  const f = scanContent('db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);', 'a.js');
  assert.ok(ids(f).includes('sqli-template-literal'));
});

test('parameterized query passes', () => {
  const f = scanContent('db.query("SELECT * FROM users WHERE id = $1", [id]);', 'a.js');
  assert.equal(f.length, 0);
});

test('detects Python f-string SQL', () => {
  const f = scanContent('cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")', 'a.py');
  assert.ok(ids(f).includes('sqli-python-fstring'));
});

// ---------- XSS ----------

test('detects innerHTML with dynamic content, allows static literal', () => {
  const bad = scanContent('el.innerHTML = userInput;', 'a.js');
  assert.ok(ids(bad).includes('xss-inner-html'));

  const ok = scanContent('el.innerHTML = "<b>hi</b>";', 'a.js');
  assert.equal(ids(ok).filter((i) => i === 'xss-inner-html').length, 0);
});

test('detects dangerouslySetInnerHTML without sanitizer', () => {
  const bad = scanContent('<div dangerouslySetInnerHTML={{ __html: data }} />', 'a.tsx');
  assert.ok(ids(bad).includes('xss-dangerously-set-inner-html'));

  const ok = scanContent(
    '<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data) }} />',
    'a.tsx'
  );
  assert.equal(ids(ok).filter((i) => i === 'xss-dangerously-set-inner-html').length, 0);
});

// ---------- Supabase ----------

test('flags service_role in client file, not in server file', () => {
  const code = 'const key = process.env.SUPABASE_SERVICE_ROLE_KEY;';
  const client = scanContent(code, 'components/Admin.tsx');
  assert.ok(ids(client).includes('supabase-service-role-in-client'));

  const server = scanContent(code, 'server/admin.js');
  assert.equal(ids(server).filter((i) => i === 'supabase-service-role-in-client').length, 0);
});

test('flags NEXT_PUBLIC_ secret env var', () => {
  const f = scanContent('const k = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;', 'lib/db.js');
  assert.ok(ids(f).includes('supabase-public-env-secret'));
});

test('flags CREATE TABLE without RLS, passes with RLS', () => {
  const bad = scanContent('CREATE TABLE posts (id uuid);', 'migrations/001.sql');
  assert.ok(ids(bad).includes('supabase-missing-rls'));

  const ok = scanContent(
    'CREATE TABLE posts (id uuid);\nALTER TABLE posts ENABLE ROW LEVEL SECURITY;',
    'migrations/001.sql'
  );
  assert.equal(ids(ok).filter((i) => i === 'supabase-missing-rls').length, 0);
});

// ---------- Suppression & file filtering ----------

test('inline suppression comment silences finding', () => {
  const f = scanContent(
    'const key = "AKIAIOSFODNN7EXAMPLE"; // vibe-guardian: ignore',
    'a.js'
  );
  assert.equal(f.length, 0);
});

test('shouldScan filters lockfiles and unknown extensions but keeps .env', () => {
  assert.equal(shouldScan('package-lock.json'), false);
  assert.equal(shouldScan('photo.png'), false);
  assert.equal(shouldScan('app.ts'), true);
  assert.equal(shouldScan('.env'), true);
  assert.equal(shouldScan('.env.example'), false);
});
