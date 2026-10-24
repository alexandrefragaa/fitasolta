import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { spawn } from "node:child_process";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../src/server.js", import.meta.url));
const testPassword = "Turso-Persistence-Test-2026!";
const adminPasswordHash = bcrypt.hashSync(testPassword, 4);
const sessionSecret = "test-session-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reservePort() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function startApp(port, databasePath) {
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      SESSION_SECRET: sessionSecret,
      ADMIN_PASSWORD_HASH: adminPasswordHash,
      TURSO_DATABASE_URL: "file:" + databasePath,
      TURSO_AUTH_TOKEN: "local-libsql-test-token",
      HOST_TURSO: "",
      TOKEN_TURSO: "",
      TRUST_PROXY: "0",
      GEMINI_API_KEY: "",
      OPENAI_API_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
  child.testLogs = () => logs;
  return child;
}

async function waitForDatabase(child, baseUrl) {
  let lastStatus = "no response";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("FitaSolta exited during startup.\n" + child.testLogs());
    }
    try {
      const response = await fetch(baseUrl + "/api/health", {
        signal: AbortSignal.timeout(1000),
        headers: { connection: "close" }
      });
      const body = await response.json();
      lastStatus = String(response.status) + " " + JSON.stringify(body);
      if (response.ok && body.database === "connected") return;
    } catch (error) {
      lastStatus = error.message;
    }
    await pause(100);
  }
  throw new Error("Turso/libSQL did not become ready. Last response: " + lastStatus + "\n" + child.testLogs());
}

async function stopApp(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, pause(5000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

function cookieFrom(response) {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "expected the server to set its session cookie");
  return header.split(";")[0];
}

async function requestJson(baseUrl, route, options = {}) {
  const headers = { connection: "close" };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["X-CSRF-Token"] = options.csrf;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(baseUrl + route, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(5000)
  });
  const raw = await response.text();
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
  return { response, body };
}

test("libSQL persistence survives restart and keeps the editorial publication gate", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "fitasolta-libsql-"));
  const databasePath = path.join(tempDir, "persistent-test.db");
  const port = await reservePort();
  const baseUrl = "http://127.0.0.1:" + port;
  let child;

  t.after(async () => {
    await stopApp(child);
    await rm(tempDir, { recursive: true, force: true });
  });

  child = startApp(port, databasePath);
  await waitForDatabase(child, baseUrl);

  const health = await requestJson(baseUrl, "/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.database, "connected");

  const csrfResponse = await requestJson(baseUrl, "/api/csrf");
  assert.equal(csrfResponse.response.status, 200);
  let cookie = cookieFrom(csrfResponse.response);
  let csrf = csrfResponse.body.csrfToken;

  const login = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    cookie,
    csrf,
    body: { password: testPassword }
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  cookie = cookieFrom(login.response);
  csrf = login.body.csrfToken;

  const entityA = await requestJson(baseUrl, "/api/entities", {
    method: "POST",
    cookie,
    csrf,
    body: {
      name: "Entidade persistente A",
      type: "person",
      description: "Registro de teste automatizado.",
      source_url: "https://example.org/source-a",
      source_date: "2026-10-24",
      evidence_status: "nao_verificado"
    }
  });
  assert.equal(entityA.response.status, 201, JSON.stringify(entityA.body));
  const entityAId = entityA.body.entity.id;

  const entityB = await requestJson(baseUrl, "/api/entities", {
    method: "POST",
    cookie,
    csrf,
    body: {
      name: "Entidade persistente B",
      type: "organization",
      description: "Segundo registro de teste automatizado.",
      source_url: "https://example.org/source-b",
      source_date: "",
      evidence_status: "nao_verificado"
    }
  });
  assert.equal(entityB.response.status, 201, JSON.stringify(entityB.body));
  const entityBId = entityB.body.entity.id;

  const relation = await requestJson(baseUrl, "/api/relationships", {
    method: "POST",
    cookie,
    csrf,
    body: {
      source_id: entityAId,
      target_id: entityBId,
      label: "relação de teste",
      description: "A relação existe apenas para validar persistência.",
      source_url: "https://example.org/relationship-evidence",
      source_date: "",
      evidence_status: "nao_verificado"
    }
  });
  assert.equal(relation.response.status, 201, JSON.stringify(relation.body));
  const relationId = relation.body.relationship.id;

  const createdClaim = await requestJson(baseUrl, "/api/admin/claims", {
    method: "POST",
    cookie,
    csrf,
    body: {
      speaker: "Pessoa de teste",
      video_url: "https://www.youtube.com/watch?v=gXN1JxBkyX8",
      source_kind: "video_original",
      timestamp: "00:01:20",
      quote: "Afirmação fictícia criada para testar persistência.",
      context: "Contexto fictício, sem efeito factual; teste automatizado.",
      claim_type: "factual",
      verdict: "nao_verificada",
      explanation: "Não constitui uma checagem real.",
      supporting_evidence: "",
      contradictory_evidence: "",
      journalism_checks: ["https://example.org/check"],
      primary_sources: ["https://example.org/primary"]
    }
  });
  assert.equal(createdClaim.response.status, 201, JSON.stringify(createdClaim.body));
  const claimId = createdClaim.body.id;

  const publicDrafts = await requestJson(baseUrl, "/api/claims");
  assert.equal(publicDrafts.response.status, 200);
  assert.equal(publicDrafts.body.claims.some((claim) => claim.id === claimId), false);

  const savedSources = await requestJson(baseUrl, "/api/admin/claims/" + claimId, { cookie });
  assert.equal(savedSources.response.status, 200);
  assert.equal(savedSources.body.sources.length, 2);

  const review = await requestJson(baseUrl, "/api/admin/claims/" + claimId + "/reviews", {
    method: "POST",
    cookie,
    csrf,
    body: { model: "automated-test", output: { verdict: "inconclusiva", note: "Test only." } }
  });
  assert.equal(review.response.status, 201, JSON.stringify(review.body));

  const approve = await requestJson(baseUrl, "/api/admin/claims/" + claimId + "/decision", {
    method: "POST",
    cookie,
    csrf,
    body: { decision: "approved" }
  });
  assert.equal(approve.response.status, 200, JSON.stringify(approve.body));

  const publish = await requestJson(baseUrl, "/api/admin/claims/" + claimId + "/decision", {
    method: "POST",
    cookie,
    csrf,
    body: { decision: "published" }
  });
  assert.equal(publish.response.status, 200, JSON.stringify(publish.body));

  const publicClaim = await requestJson(baseUrl, "/api/claims/" + claimId);
  assert.equal(publicClaim.response.status, 200);
  assert.equal(publicClaim.body.claim.id, claimId);

  /* Structured case and person records must remain private until approval/publication. */
  const createdCase = await requestJson(baseUrl, "/api/admin/cases", {
    method: "POST",
    cookie,
    csrf,
    body: {
      title: "Caso fictício de persistência",
      summary: "Resumo fictício usado apenas para validar o fluxo editorial e a persistência.",
      category: "investigacao_publica",
      jurisdiction: "Brasil",
      responsible_agency: "Órgão de teste",
      official_reference: "TEST-CASE-001",
      source_url: "https://example.org/case-source",
      status: "apuracao_preliminar",
      opened_at: "2026-10-01",
      last_checked_at: "2026-10-24",
      next_review_at: "2026-11-01"
    }
  });
  assert.equal(createdCase.response.status, 201, JSON.stringify(createdCase.body) + "\n" + child.testLogs());
  const caseId = createdCase.body.id;
  const publicCasesBefore = await requestJson(baseUrl, "/api/cases");
  assert.equal(publicCasesBefore.body.cases.some((item) => item.id === caseId), false);

  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/cases/" + caseId + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }
  const publicCase = await requestJson(baseUrl, "/api/cases/" + caseId);
  assert.equal(publicCase.response.status, 200);
  assert.equal(publicCase.body.case.id, caseId);
  const rejectPublishedCase = await requestJson(baseUrl, "/api/admin/cases/" + caseId + "/decision", {
    method: "POST", cookie, csrf, body: { decision: "rejected" }
  });
  assert.equal(rejectPublishedCase.response.status, 409);
  assert.equal((await requestJson(baseUrl, "/api/cases/" + caseId)).response.status, 200);

  const createdPerson = await requestJson(baseUrl, "/api/admin/people", {
    method: "POST",
    cookie,
    csrf,
    body: {
      name: "Pessoa fictícia de teste",
      type: "person",
      description: "Perfil fictício sem correspondência com pessoa real, criado para teste de privacidade.",
      source_url: "https://example.org/person-source",
      source_date: "2026-10-24",
      evidence_status: "nao_verificado"
    }
  });
  assert.equal(createdPerson.response.status, 201, JSON.stringify(createdPerson.body));
  const personId = createdPerson.body.id;
  const publicPeopleBefore = await requestJson(baseUrl, "/api/entities");
  assert.equal(publicPeopleBefore.body.entities.some((item) => item.id === personId), false);

  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/people/" + personId + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }
  const publicPeopleAfter = await requestJson(baseUrl, "/api/entities");
  assert.equal(publicPeopleAfter.body.entities.some((item) => item.id === personId), true);
  const rejectPublishedPerson = await requestJson(baseUrl, "/api/admin/people/" + personId + "/decision", {
    method: "POST", cookie, csrf, body: { decision: "rejected" }
  });
  assert.equal(rejectPublishedPerson.response.status, 409);
  assert.equal((await requestJson(baseUrl, "/api/entities")).body.entities.some((item) => item.id === personId), true);

  const role = await requestJson(baseUrl, "/api/admin/cases/" + caseId + "/people", {
    method: "POST",
    cookie,
    csrf,
    body: {
      entity_id: personId,
      role: "testemunha",
      role_description: "Papel de teste sem alegação factual.",
      valid_from: "2026-10-01",
      valid_to: "2026-10-24",
      source_url: "https://example.org/person-role-source"
    }
  });
  assert.equal(role.response.status, 201, JSON.stringify(role.body));
  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/case-people/" + role.body.id + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }

  const event = await requestJson(baseUrl, "/api/admin/cases/" + caseId + "/events", {
    method: "POST",
    cookie,
    csrf,
    body: {
      event_type: "atualizacao_oficial",
      event_date: "2026-10-20",
      document_date: "2026-10-21",
      published_date: "2026-10-22",
      title: "Movimentação fictícia",
      description: "Evento fictício para validar a linha do tempo.",
      source_url: "https://example.org/case-event-source",
      verification_status: "not_checked"
    }
  });
  assert.equal(event.response.status, 201, JSON.stringify(event.body));
  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/case-events/" + event.body.id + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }

  const secondClaim = await requestJson(baseUrl, "/api/admin/claims", {
    method: "POST",
    cookie,
    csrf,
    body: {
      speaker: "Outra pessoa de teste",
      video_url: "https://www.youtube.com/watch?v=gXN1JxBkyX8",
      source_kind: "video_original",
      timestamp: "00:02:20",
      quote: "Afirmação fictícia alternativa para testar relações.",
      context: "Contexto fictício sem afirmação sobre pessoa real.",
      claim_type: "factual",
      verdict: "nao_verificada",
      explanation: "Teste automatizado; não constitui uma checagem real.",
      supporting_evidence: "",
      contradictory_evidence: "",
      journalism_checks: ["https://example.org/second-check"],
      primary_sources: ["https://example.org/second-primary"]
    }
  });
  assert.equal(secondClaim.response.status, 201, JSON.stringify(secondClaim.body));
  const secondClaimId = secondClaim.body.id;
  const linkClaim = await requestJson(baseUrl, "/api/admin/cases/" + caseId + "/claims", {
    method: "POST", cookie, csrf, body: { claim_id: secondClaimId }
  });
  assert.equal(linkClaim.response.status, 200, JSON.stringify(linkClaim.body));
  const secondReview = await requestJson(baseUrl, "/api/admin/claims/" + secondClaimId + "/reviews", {
    method: "POST", cookie, csrf,
    body: { model: "automated-test", output: { verdict: "inconclusiva", note: "Test only." } }
  });
  assert.equal(secondReview.response.status, 201, JSON.stringify(secondReview.body));
  for (const decision of ["approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/claims/" + secondClaimId + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }

  const relationDraft = await requestJson(baseUrl, "/api/admin/claims/" + claimId + "/relations", {
    method: "POST",
    cookie,
    csrf,
    body: {
      related_claim_id: secondClaimId,
      relation_type: "contradicts",
      explanation: "Relação fictícia usada para testar a publicação editorial, não uma conclusão factual."
    }
  });
  assert.equal(relationDraft.response.status, 201, JSON.stringify(relationDraft.body));
  const contradictionBefore = await requestJson(baseUrl, "/api/contradictions");
  assert.equal(contradictionBefore.body.contradictions.some((item) => item.id === relationDraft.body.id), false);
  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/claim-relations/" + relationDraft.body.id + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }
  const contradictionAfter = await requestJson(baseUrl, "/api/contradictions");
  assert.equal(contradictionAfter.body.contradictions.some((item) => item.id === relationDraft.body.id), true);

  const clip = await requestJson(baseUrl, "/api/admin/clips", {
    method: "POST",
    cookie,
    csrf,
    body: {
      case_id: caseId,
      claim_id: claimId,
      title: "Corte de teste 00:01:20–00:01:40",
      video_url: "https://www.youtube.com/watch?v=gXN1JxBkyX8",
      start_timestamp: "00:01:20",
      end_timestamp: "00:01:40",
      quote: "Trecho fictício para teste de persistência.",
      context_before: "Contexto anterior fictício.",
      context_after: "Contexto posterior fictício.",
      notes: "Metadados do corte; nenhum arquivo de vídeo é copiado."
    }
  });
  assert.equal(clip.response.status, 201, JSON.stringify(clip.body));
  const clipsBefore = await requestJson(baseUrl, "/api/clips");
  assert.equal(clipsBefore.body.clips.some((item) => item.id === clip.body.id), false);
  for (const decision of ["in_review", "approved", "published"]) {
    const response = await requestJson(baseUrl, "/api/admin/clips/" + clip.body.id + "/decision", {
      method: "POST", cookie, csrf, body: { decision }
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
  }
  const clipsAfter = await requestJson(baseUrl, "/api/clips");
  assert.equal(clipsAfter.body.clips.some((item) => item.id === clip.body.id), true);
  const rejectPublishedClip = await requestJson(baseUrl, "/api/admin/clips/" + clip.body.id + "/decision", {
    method: "POST", cookie, csrf, body: { decision: "rejected" }
  });
  assert.equal(rejectPublishedClip.response.status, 409);
  assert.equal((await requestJson(baseUrl, "/api/clips")).body.clips.some((item) => item.id === clip.body.id), true);

  const publicCaseAfter = await requestJson(baseUrl, "/api/cases/" + caseId);
  assert.equal(publicCaseAfter.body.people.some((item) => item.entity_id === personId), true);
  assert.equal(publicCaseAfter.body.events.some((item) => item.id === event.body.id), true);
  assert.equal(publicCaseAfter.body.clips.some((item) => item.id === clip.body.id), true);

  await stopApp(child);
  child = undefined;
  child = startApp(port, databasePath);
  await waitForDatabase(child, baseUrl);

  const restartedEntities = await requestJson(baseUrl, "/api/entities");
  assert.ok(restartedEntities.body.entities.some((entity) => entity.id === entityAId));
  assert.ok(restartedEntities.body.entities.some((entity) => entity.id === entityBId));

  const restartedRelations = await requestJson(baseUrl, "/api/relationships");
  assert.ok(restartedRelations.body.relationships.some((item) => item.id === relationId));

  const restartedCase = await requestJson(baseUrl, "/api/cases/" + caseId);
  assert.equal(restartedCase.response.status, 200);
  assert.equal(restartedCase.body.case.id, caseId);
  assert.ok(restartedCase.body.people.some((item) => item.entity_id === personId));
  assert.ok(restartedCase.body.events.some((item) => item.id === event.body.id));
  assert.ok(restartedCase.body.clips.some((item) => item.id === clip.body.id));

  const restartedContradictions = await requestJson(baseUrl, "/api/contradictions");
  assert.ok(restartedContradictions.body.contradictions.some((item) => item.id === relationDraft.body.id));
  const rejectPublishedRelation = await requestJson(baseUrl, "/api/admin/claim-relations/" + relationDraft.body.id + "/decision", {
    method: "POST", cookie, csrf, body: { decision: "rejected" }
  });
  assert.equal(rejectPublishedRelation.response.status, 409);
  assert.ok((await requestJson(baseUrl, "/api/contradictions")).body.contradictions.some((item) => item.id === relationDraft.body.id));

  const restartedClips = await requestJson(baseUrl, "/api/clips");
  assert.ok(restartedClips.body.clips.some((item) => item.id === clip.body.id));
});
