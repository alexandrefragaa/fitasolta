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

  await stopApp(child);
  child = undefined;
  child = startApp(port, databasePath);
  await waitForDatabase(child, baseUrl);

  const restartedEntities = await requestJson(baseUrl, "/api/entities");
  assert.ok(restartedEntities.body.entities.some((entity) => entity.id === entityAId));
  assert.ok(restartedEntities.body.entities.some((entity) => entity.id === entityBId));

  const restartedRelations = await requestJson(baseUrl, "/api/relationships");
  assert.ok(restartedRelations.body.relationships.some((item) => item.id === relationId));

  const restartedClaim = await requestJson(baseUrl, "/api/claims/" + claimId);
  assert.equal(restartedClaim.response.status, 200);
  assert.equal(restartedClaim.body.claim.id, claimId);
  assert.equal(restartedClaim.body.sources.length, 2);
});
