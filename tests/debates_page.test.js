import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../public/debates.html", import.meta.url), "utf8");
const debateScript = readFileSync(new URL("../public/js/debates.js", import.meta.url), "utf8");
const debateStyles = readFileSync(new URL("../public/css/debates.css", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

test("debates page uses external script and stylesheet compatible with the strict CSP", () => {
  assert.equal(inlineScripts.length, 0, "inline JavaScript is blocked by the production CSP");
  assert.equal([...html.matchAll(/<style\b[^>]*>/gi)].length, 0, "inline CSS is blocked by the production CSP");
  assert.ok(html.includes('<script src="/js/debates.js" defer></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="/css/debates.css">'));
  assert.ok(debateStyles.includes(".video-frame iframe"));
  assert.ok(debateStyles.includes("@media(max-width:600px)"));
  assert.doesNotThrow(() => new Script(debateScript));
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /frameSrc:.*youtube-nocookie\.com.*youtube\.com/);
});

test("evidence workflow exposes save, public claims and private editorial queue", () => {
  assert.match(html, /id="save-record"/);
  assert.match(html, /id="published-claims"/);
  assert.match(html, /id="admin-claims" hidden/);
  assert.match(debateScript, /\/api\/admin\/claims/);
  assert.match(debateScript, /\/api\/claims/);
});

test("evidence page preserves original video and X source links", () => {
  assert.match(html, /gXN1JxBkyX8/);
  assert.match(html, /Haaaysb\/status\/2113818839821562016/);
  assert.match(html, /<strong>Correção de contexto:<\/strong>/);
});

test("backend distinguishes an unconfigured database from a fatal startup crash", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /const databaseConfigured = Boolean\(TURSO_URL && TURSO_TOKEN\)/);
  assert.match(server, /database: "not_configured"/);
  assert.match(server, /DATABASE_NOT_CONFIGURED/);
  assert.match(server, /res\.status\(503\)/);
});

test("backend respects the explicit Vercel trust-proxy setting", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /process\.env\.TRUST_PROXY === "1" \|\| IS_PRODUCTION/);
  assert.match(server, /if \(TRUST_PROXY\) app\.set\("trust proxy", 1\)/);
});

test("published checks expose a control to inspect registered sources and evidence", () => {
  assert.match(debateScript, /Ver fontes registradas/);
  assert.match(debateScript, /\/api\/claims\/.*encodeURIComponent/);
  assert.match(debateScript, /Evidência favorável/);
  assert.match(debateScript, /Limitações\/evidências contrárias/);
});

test("editorial decisions are recorded against the latest review", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /SELECT id FROM claim_reviews WHERE claim_id=\? ORDER BY created_at DESC LIMIT 1/);
  assert.match(server, /UPDATE claim_reviews SET reviewer_decision=\?,reviewed_at=CURRENT_TIMESTAMP WHERE id=\?/);
});

test("related-claim UI is present and public relations filter unpublished claims", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(debateScript, /Relacionar com outra checagem/);
  assert.match(debateScript, /Salvar relação/);
  assert.match(debateScript, /Checagens relacionadas/);
  assert.match(server, /c\.status='published'/);
  assert.match(server, /claim_relations/);
});
