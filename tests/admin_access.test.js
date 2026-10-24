import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const home=read("../public/index.html");
const login=read("../private/admin-login.html");
const admin=read("../private/admin-dashboard.html");
const app=read("../public/js/app.js");
const server=read("../src/server.js");
const cron=JSON.parse(read("../vercel.json"));

test("homepage não oferece votação, comparação ou revisão manual",()=>{
  for(const link of ['href="/votacao.html"','href="/comparar.html"','href="/debates.html"','href="/revisao.html"']) assert.ok(!home.includes(link));
  assert.ok(home.includes('id="source-category-filter"'));
  assert.ok(home.includes('id="source-stats"'));
});
test("páginas legadas não são distribuídas como arquivos públicos",()=>{
  for(const file of ["votacao.html","debates.html","comparar.html","revisao.html"]) assert.equal(existsSync(new URL("../public/"+file,import.meta.url)),false,file+" ainda existe em public");
  assert.ok(server.includes('app.get(["/debates.html","/comparar.html","/votacao.html","/revisao.html"]'));
});
test("painel admin fica fora de public e não contém revisão manual",()=>{
  assert.equal(existsSync(new URL("../public/admin-dashboard.html",import.meta.url)),false);
  assert.ok(login.includes('id="login-form"'));
  assert.ok(admin.includes('id="source-queue-panel"'));
  assert.ok(!admin.includes('id="gemini-review-panel"'));
});
test("cron diário descobre fontes oficiais e tem rota protegida",()=>{
  assert.equal(cron.crons[0].path,"/api/cron/process-sources");
  assert.equal(cron.crons[0].schedule,"0 12 * * *");
  assert.ok(server.includes("discoverDailySources(queue)"));
  assert.ok(server.includes("https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml"));
  assert.ok(server.includes("https://www12.senado.leg.br/noticias/rss.xml"));
  assert.ok(server.includes("https://www.camara.leg.br/noticias/rss/ultimas-noticias"));
  assert.ok(server.includes('app.get("/api/cron/process-sources",async(req,res)=>{'));
});
test("rota pública lê os resumos gravados na fila e gera conexões",()=>{
  const start=server.indexOf('app.get("/api/sources"');
  const end=server.indexOf("/* Fontes externas são registradas",start);
  const route=server.slice(start,end);
  assert.ok(route.includes("readTursoSourceQueue()"));
  assert.ok(route.includes("stats"));
  assert.ok(server.includes("persistSourceConnections(source,review)"));
});
test("votações desativadas sem apagar histórico",()=>{
  assert.ok(server.includes('app.all("/api/topic-votes"'));
  assert.ok(server.includes(".status(410)"));
});
test("a pesquisa mantém o escape SQL correto",()=>{
  assert.ok(server.includes('search.replace(/[\\\\%_]/g, (char) => "\\\\" + char)'));
});
test("JavaScript do frontend é sintaticamente válido",()=>{
  assert.doesNotThrow(()=>new Script(app));
});
