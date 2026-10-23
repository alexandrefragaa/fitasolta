
import test from "node:test";
import assert from "node:assert/strict";

import {
  EVIDENCE_STATUSES,
  cleanString,
  isIsoDate,
  normalizeHttpUrl,
  tokensMatch
} from "../src/validation.js";

test("tokensMatch aceita igualdade e rejeita tamanhos diferentes", () => {
  assert.equal(tokensMatch("abc123", "abc123"), true);
  assert.equal(tokensMatch("abc", "abcd"), false);
  assert.equal(tokensMatch(undefined, "abc"), false);
  assert.equal(tokensMatch("abc", undefined), false);
  assert.equal(tokensMatch("", ""), false);
});

test("normaliza somente URLs HTTP/HTTPS", () => {
  assert.equal(
    normalizeHttpUrl("https://example.com/page"),
    "https://example.com/page"
  );

  assert.equal(
    normalizeHttpUrl("http://example.com/page"),
    "http://example.com/page"
  );

  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("file:///documento"), null);
  assert.equal(normalizeHttpUrl(""), "");
});

test("valida datas ISO reais", () => {
  assert.equal(isIsoDate("2026-10-23"), true);
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("23/10/2026"), false);
  assert.equal(isIsoDate(""), true);
});

test("limpa strings e limita o tamanho", () => {
  assert.equal(
    cleanString("  Caso A  ", {
      min: 1,
      max: 20,
      required: true
    }),
    "Caso A"
  );

  assert.equal(
    cleanString("", {
      min: 1,
      max: 20,
      required: true
    }),
    null
  );

  assert.equal(
    cleanString("texto longo", { max: 3 }),
    null
  );

  assert.equal(
    cleanString(null, { max: 20 }),
    null
  );
});

test("as classificações de evidência contêm os estados esperados", () => {
  assert.ok(EVIDENCE_STATUSES.includes("nao_verificado"));
  assert.ok(!EVIDENCE_STATUSES.includes("qualquer_coisa"));
});