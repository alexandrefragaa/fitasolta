
"use strict";
(() => {
 const videoUrls = {
  "1":"https://youtu.be/rUnAbA73RH0?is=LxNoRKpeYiAnLoFN",
  "2":"https://youtu.be/T8oPN6v1L0c?is=txDksFJckshVlQfC",
  "3":"https://youtu.be/Z2AA0h2wr4U?is=VoeNo02nD5dUGmYI",
  "4":"https://youtu.be/QhluFzoPl30?is=ftcExdKvGcM5ApFi",
  "5":"https://youtu.be/f62pfk2eHCA?is=CeoLcSy2qOQSCJVc",
  "6":"https://youtu.be/X1fp4JzouvA?is=JRPv6B6G0ZsOSjKo",
  "7":"https://www.youtube.com/live/tokmOZltAG8?is=-pbEdidFvWlvq3b8",
  "8":"https://www.youtube.com/live/6ktnzdym2-I?is=ez5AUY1V-p98eQR8",
  "9":"https://youtu.be/gXN1JxBkyX8?is=rpxtHicZ5OQOOTIi",
  "10":"https://x.com/Haaaysb/status/2113818839821562016"
 };
 const byId = id => document.getElementById(id);
 const value = id => byId(id)?.value.trim() || "";
 function record() {
  return {
   project:"FitaSolta",
   createdAt:new Date().toISOString(),
   speaker:value("speaker"),
   videoNumber:value("video-id"),
   videoUrl:videoUrls[value("video-id")] || "",
   timestamp:value("timestamp"),
   quote:value("quote"),
   context:value("context-text"),
   claimType:value("claim-type"),
   journalismChecks:value("journalism").split("\n").map(s=>s.trim()).filter(Boolean),
   primarySources:value("primary").split("\n").map(s=>s.trim()).filter(Boolean),
   supportingEvidence:value("support"),
   contradictoryEvidence:value("contradict"),
   provisionalClassification:value("verdict"),
   explanation:value("explanation"),
   publicationStatus:"rascunho_requer_revisao_humana"
  };
 }
 byId("save-draft")?.addEventListener("click", async () => {
  const form = byId("claim-form");
  if (!form.reportValidity()) {
   byId("export-status").textContent = "Preencha os campos obrigatórios antes de salvar.";
   return;
  }
  const data = record();
  const button = byId("save-draft");
  button.disabled = true;
  byId("export-status").textContent = "Salvando rascunho no servidor…";
  try {
   const csrfResponse = await fetch("/api/csrf", { credentials: "same-origin", cache: "no-store" });
   const csrfData = await csrfResponse.json();
   if (!csrfResponse.ok || !csrfData.csrfToken) throw new Error("Não foi possível obter o token de segurança. Atualize a página.");
   const response = await fetch("/api/admin/claims", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfData.csrfToken },
    body: JSON.stringify({
     speaker: data.speaker, video_url: data.videoUrl, timestamp: data.timestamp,
     quote: data.quote, context: data.context, claim_type: data.claimType,
     verdict: data.provisionalClassification, explanation: data.explanation,
     journalism_checks: data.journalismChecks.join("\n"),
     primary_sources: data.primarySources.join("\n"),
     supporting_evidence: data.supportingEvidence,
     contradictory_evidence: data.contradictoryEvidence
    })
   });
   const payload = await response.json().catch(() => ({}));
   if (!response.ok) {
    if (response.status === 401) throw new Error("Entre na Área administrativa da página inicial e volte aqui para salvar.");
    throw new Error(payload.error || "Não foi possível salvar o rascunho.");
   }
   byId("export-status").textContent = "Rascunho salvo no banco persistente (ID " + payload.id + "). Não foi publicado; ainda exige revisão editorial.";
   byId("export-status").dataset.text = "ID: " + payload.id + "\n" + JSON.stringify(data, null, 2);
  } catch (error) {
   byId("export-status").textContent = error.message || "Falha ao salvar. Você ainda pode exportar o JSON local.";
  } finally {
   button.disabled = false;
  }
 });
 byId("claim-form").addEventListener("submit", event => {
  event.preventDefault();
  const data=record();
  const output = [
   "FICHA DE CHECAGEM — FITASOLTA",
   "Pessoa: "+data.speaker,
   "Vídeo: "+data.videoUrl,
   "Timestamp: "+data.timestamp,
   "Afirmação literal: "+data.quote,
   "Contexto: "+data.context,
   "Tipo: "+data.claimType,
   "Checagens jornalísticas:\n"+(data.journalismChecks.join("\n")||"Ainda não informado"),
   "Fontes primárias:\n"+(data.primarySources.join("\n")||"Ainda não informado"),
   "Evidências favoráveis: "+(data.supportingEvidence||"Ainda não informado"),
   "Evidências contrárias/limitações: "+(data.contradictoryEvidence||"Ainda não informado"),
   "Classificação provisória: "+data.provisionalClassification,
   "Explicação: "+(data.explanation||"Ainda não redigida"),
   "STATUS: rascunho; requer revisão humana."
  ].join("\n\n");
  byId("export-status").textContent="Ficha estruturada. Revise as evidências. O arquivo ainda não é salvo no servidor.";
  byId("export-status").dataset.text=output;
 });
 byId("export-record").addEventListener("click",()=>{
  const form=byId("claim-form");
  if (!form.reportValidity()) {
   byId("export-status").textContent="Preencha os campos obrigatórios e confira o timestamp antes de exportar.";
   return;
  }
  const data=record();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="fita-solta-checagem-"+(data.timestamp.replaceAll(":","-")||"rascunho")+".json";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  byId("export-status").textContent="JSON exportado. Ele é um arquivo local e ainda não foi salvo no banco do site.";
 });
 byId("copy-record").addEventListener("click",async()=>{
  const text=byId("export-status").dataset.text;
  if(!text){byId("claim-form").requestSubmit();return;}
  try{await navigator.clipboard.writeText(text);byId("export-status").textContent="Ficha copiada para a área de transferência.";}
  catch{byId("export-status").textContent="Não foi possível copiar automaticamente. Use Exportar ficha JSON.";}
 });
})();
