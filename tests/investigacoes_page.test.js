import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../public/investigacoes.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/js/investigacoes.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/css/investigacoes.css", import.meta.url), "utf8");

test("investigations page uses external assets and safe DOM rendering", () => {
  assert.ok(html.includes('<script src="/js/investigacoes.js" defer></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="/css/investigacoes.css">'));
  assert.equal([...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim()).length, 0);
  assert.doesNotThrow(() => new Script(script));
  assert.ok(script.includes('getJson("/api/entities")'));
  assert.ok(script.includes('getJson("/api/relationships")'));
  assert.ok(script.includes('getJson("/api/claims")'));
  assert.ok(script.includes("textContent"));
  assert.ok(css.includes(".network-layout"));
  assert.ok(html.includes("Como usar este painel"));
});