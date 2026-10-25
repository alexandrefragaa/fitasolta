import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script } from "node:vm";
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const home=read("../public/index.html"),login=read("../private/admin-login.html"),admin=read("../private/admin-dashboard.html"),app=read("../public/js/app.js"),server=read("../src/server.js"),cron=JSON.parse(read("../vercel.json"));
test("homepage is a plain investigative archive with useful filters",()=>{
 for(const link of ['href="/votacao.html"','href="/comparar.html"','href="/debates.html"','href="/revisao.html"'])assert.ok(!home.includes(link));
 assert.ok(home.includes("Falas, documentos e evidências."));
 for(const mode of ["all","claims","media","legal"])assert.ok(home.includes('data-source-mode="'+mode+'"'));
 assert.ok(home.includes('id="source-person-filter"'));assert.ok(!home.includes('id="source-category-filter"'));assert.ok(home.includes('id="source-verdict-filter"'));
 assert.ok(!home.includes("source-stats"));assert.ok(!home.includes("analytics.js"));assert.ok(home.includes('id="criterios"'));
 assert.ok(!read("../public/css/style.css").includes("@keyframes"));
});
test("admin intake is inside private dashboard",()=>{
 assert.equal(existsSync(new URL("../public/admin-dashboard.html",import.meta.url)),false);
 assert.ok(login.includes('id="login-form"'));assert.ok(admin.includes('id="source-intake-form"'));assert.ok(admin.includes('id="source-intake-text"'));assert.ok(admin.includes('id="source-intake-media"'));
 assert.ok(server.includes('app.post("/api/admin/sources", requireCsrf, requireAdmin'));
});
test("queue stores raw text and media but public response hides raw text",()=>{
 assert.ok(server.includes('raw_text: "TEXT NOT NULL DEFAULT \'\'"'));
 assert.ok(server.includes("raw_text, original_url, media_url, media_type FROM source_queue"));
 const a=server.indexOf('app.get("/api/sources"'),b=server.indexOf("/* Fontes externas são registradas",a),route=server.slice(a,b);
 assert.ok(route.includes('summary:item.summary||""'));assert.ok(!route.includes("raw_text:"));
});
test("video caption parsing and evidence grounding exist",()=>{
 assert.ok(server.includes("fetchYouTubeTranscriptFromHtml"));assert.ok(server.includes("fetchYouTubeTranscriptById"));assert.ok(server.includes("FICHA_AUTO_JSON:"));assert.ok(server.includes('tools: [{ google_search: {} }]'));
 assert.ok(server.includes('verdict = "inconclusiva"'));assert.ok(server.includes("verificationBudget={remaining:Math.min(3,sources.length)}"));assert.ok(app.includes("youtube-nocookie.com/embed/"));assert.ok(app.includes("Fontes que contradizem ou limitam"));assert.ok(app.includes("sourcePersonFilter"));assert.ok(app.includes("sourceVerdictFilter"));assert.ok(app.includes("Nenhuma fonte de apoio foi vinculada"));assert.ok(app.includes("não conseguiu vincular uma fonte que contradiga"));
});
test("public archive hides processing metadata and keeps YouTube source fallbacks",()=>{
 assert.ok(!app.includes('" · Processada"'));
 assert.ok(!app.includes('"Processado em "'));
 assert.ok(!app.includes('"Pesquisa executada em "'));
 assert.ok(app.includes("source.media_url, source.original_url, source.url"));
 assert.ok(app.includes("Abrir vídeo original"));
});
test("duplicate detection treats YouTube URL variants as the same video",()=>{
 assert.ok(app.includes('return "youtube:" + videoId'));
 assert.ok(server.includes('return"youtube:"+videoId'));
});
test("contradiction filter requires a usable source URL and videos link to the indicated timestamp",()=>{
 assert.ok(app.includes('fact.contradictory_sources.some((item) => Boolean(safeHttpUrl(item?.url)))'));
 assert.ok(app.includes("videoTimestampUrl(videoSourceUrl, start)"));
 assert.ok(app.includes("Abrir vídeo no trecho indicado"));
});
test("AI review is clearly labeled as a suggestion and not auto-published",()=>{
 assert.ok(app.includes("SUGESTÃO DE IA · NÃO SALVA NEM PUBLICA ESTA FICHA"));
 assert.ok(app.includes("Resultado sugerido:"));
});
test("admin queue supports status, duplicate and mural-link triage",()=>{
 assert.ok(admin.includes('id="source-queue-status-filter"'));
 assert.ok(admin.includes('id="source-queue-counts"'));
 assert.ok(app.includes("sourceQueueDuplicateKeys"));
 assert.ok(app.includes("Sem vínculo no mural"));
 assert.ok(server.includes("linked_to_mural: linkedSourceKeys.has"));
});
test("daily automation remains protected",()=>{
 assert.equal(cron.crons[0].path,"/api/cron/process-sources");assert.equal(cron.crons[0].schedule,"0 12 * * *");
 assert.ok(server.includes("discoverDailySources(queue)"));assert.ok(server.includes("legacyCompleted.slice(0,legacyCapacity)"));assert.ok(server.includes("FICHA_AUTO_JSON:"));assert.ok(server.includes('req.get("authorization")!=="Bearer "+CRON_SECRET'));
});
test("voting endpoints are disabled without deleting stored records",()=>{assert.ok(server.includes('app.all("/api/topic-votes"'));assert.ok(server.includes(".status(410)"))});
test("browser JavaScript syntax",()=>assert.doesNotThrow(()=>new Script(app)));
