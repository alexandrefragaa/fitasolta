import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../public/investigations.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/js/investigations.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/css/investigations.css", import.meta.url), "utf8");

test("structured investigations page uses external JS/CSS and passes strict CSP", () => {
  assert.equal([...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].filter(m => m[1].trim()).length, 0);
  assert.equal([...html.matchAll(/<style\b[^>]*>/gi)].length, 0);
  assert.ok(html.includes('<script src="/js/investigations.js" defer></script>'));
  assert.ok(html.includes('<link rel="stylesheet" href="/css/investigations.css">'));
  assert.doesNotThrow(() => new Script(script));
  assert.ok(css.includes(".comparison-grid"));
});

test("structured page exposes case, person, contradiction and video-cut forms", () => {
  for (const id of ["case-form","person-form","role-form","event-form","clip-form","relation-form"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing form " + id);
  }
  assert.ok(html.includes("Contradições"));
  assert.ok(html.includes("Cortes de vídeo"));
  assert.ok(script.includes("/api/contradictions"));
  assert.ok(script.includes("/api/admin/cases"));
  assert.ok(script.includes("/api/admin/people"));
  assert.ok(script.includes("/api/admin/clips"));
});
