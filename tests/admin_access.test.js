import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const publicHome = read("../public/index.html");
const adminLogin = read("../private/admin-login.html");
const adminDashboard = read("../private/admin-dashboard.html");
const appScript = read("../public/js/app.js");
const server = read("../src/server.js");
const cronConfig = JSON.parse(read("../vercel.json"));

test("a página pública não expõe botão nem diálogo administrativo", () => {
  assert.ok(!publicHome.includes('id="admin-open"'));
  assert.ok(!publicHome.includes('id="admin-dialog"'));
  assert.ok(!publicHome.includes('href="/revisao.html"'));
});

test("os arquivos do painel administrativo ficam fora do diretório estático público", () => {
  assert.equal(existsSync(new URL("../public/admin-dashboard.html", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/admin-login.html", import.meta.url)), false);
  assert.ok(adminLogin.includes('id="login-form"'));
  assert.ok(!adminLogin.includes('id="source-queue-panel"'));
  assert.ok(adminDashboard.includes('id="source-queue-panel"'));
  assert.ok(adminDashboard.includes('id="retry-source-errors"'));
});

test("o servidor só entrega o painel após sessão autenticada", () => {
  assert.ok(server.includes('app.get("/admin", (req, res, next) => {'));
  assert.ok(server.includes("req.session?.isAdmin === true"));
  assert.ok(server.includes('path.join(rootDir, "private", "admin-dashboard.html")'));
  assert.ok(server.includes('if (req.session?.isAdmin !== true) return res.redirect(302, "/admin");'));
});

test("a automação diária exige o segredo CRON_SECRET", () => {
  assert.equal(cronConfig.crons.length, 1);
  assert.equal(cronConfig.crons[0].path, "/api/cron/process-sources");
  assert.equal(cronConfig.crons[0].schedule, "0 12 * * *");
  assert.ok(server.includes('const CRON_SECRET = process.env.CRON_SECRET || "";'));
  assert.ok(server.includes('app.get("/api/cron/process-sources", async (req, res) => {'));
  assert.ok(server.includes('req.get("authorization") !== `Bearer ${CRON_SECRET}`'));
  assert.ok(server.includes('.slice(0, 3)'));
});

test("o JavaScript do frontend é sintaticamente válido", () => {
  assert.doesNotThrow(() => new Script(appScript));
});
