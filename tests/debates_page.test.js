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
