import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../public/debates.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);

test("debates page has a syntactically valid inline script", () => {
  assert.equal(inlineScripts.length, 1, "expected exactly one inline script");
  assert.doesNotThrow(() => new Script(inlineScripts[0]));
});

test("evidence workflow exposes save, public claims and private editorial queue", () => {
  assert.match(html, /id="save-record"/);
  assert.match(html, /id="published-claims"/);
  assert.match(html, /id="admin-claims" hidden/);
  assert.match(html, /\/api\/admin\/claims/);
  assert.match(html, /\/api\/claims/);
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
  const html = readFileSync(new URL("../public/debates.html", import.meta.url), "utf8");
  assert.match(html, /Ver fontes registradas/);
  assert.match(html, /\/api\/claims\/.*encodeURIComponent/);
  assert.match(html, /Evidência favorável/);
  assert.match(html, /Limitações\/evidências contrárias/);
});

test("editorial decisions are recorded against the latest review", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /SELECT id FROM claim_reviews WHERE claim_id=\? ORDER BY created_at DESC LIMIT 1/);
  assert.match(server, /UPDATE claim_reviews SET reviewer_decision=\?,reviewed_at=CURRENT_TIMESTAMP WHERE id=\?/);
});

test("related-claim UI is present and public relations filter unpublished claims", () => {
  const html = readFileSync(new URL("../public/debates.html", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(html, /Relacionar com outra checagem/);
  assert.match(html, /Salvar relação/);
  assert.match(html, /Checagens relacionadas/);
  assert.match(server, /c\.status='published'/);
  assert.match(server, /claim_relations/);
});
