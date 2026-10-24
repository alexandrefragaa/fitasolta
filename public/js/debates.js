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
  "10":"https://youtu.be/r_NN7y0iJ8w?is=A_SZ9FUw4EYdA6fO",
  "11":"https://youtu.be/JnogZ2RGZvE?is=-PNC1UAbiS5I8g1V",
  "12":"https://youtu.be/42N0vG4iOGw?is=bQo6YXEYXFfzNpMr",
  "13":"https://youtu.be/kJFYdGuwz0E?is=fm0UnqVx9MEZn9-7",
  "14":"https://x.com/Haaaysb/status/2113818839821562016"
};
 const byId = id => document.getElementById(id);
 const value = id => byId(id)?.value.trim() || "";
 function record() {
  return {
   project:"FitaSolta",
   createdAt:new Date().toISOString(),
   speaker:value("speaker"),
   videoNumber:value("video-id"),
   sourceKind:value("video-id")==="14" ? "publicacao_x" : "video_original",
   videoUrl:videoUrls[value("video-id")] || "",
   claimDate:value("claim-date"),topic:value("topic")||"outros",location:value("location"),evidenceStatus:value("evidence-status")||"nao_verificado",
   timestamp:value("timestamp"),
   quote:value("quote"),
   context:value("context-text"),
   claimType:value("claim-type"),
   journalismChecks:value("journalism").split("\n").map(s=>s.trim()).filter(Boolean),
   primarySources:value("primary").split("\n").map(s=>s.trim()).filter(Boolean),
   supportingSources:value("supporting-sources").split("\n").map(s=>s.trim()).filter(Boolean),contradictorySources:value("contradictory-sources").split("\n").map(s=>s.trim()).filter(Boolean),
   supportingEvidence:value("support"),
   contradictoryEvidence:value("contradict"),
   provisionalClassification:(({
    "Verdadeira":"verdadeira","Falsa":"falsa","Enganosa / imprecisa":"enganosa",
    "Fora de contexto":"fora_de_contexto","Inconclusiva":"inconclusiva",
    "Opinião / previsão — não verificável como fato":"opiniao_previsao","Não verificada":"nao_verificada"
   })[value("verdict")] || "nao_verificada"),
   explanation:value("explanation"),
   publicationStatus:"rascunho_requer_revisao_humana"
  };
 }
 byId("claim-form").addEventListener("submit", event => {
  event.preventDefault();
  const data=record();
  const output = [
   "FICHA DE CHECAGEM — FITASOLTA",
   "Pessoa: "+data.speaker,
   "Data: "+(data.claimDate||"não informada"),"Tema: "+data.topic,"Rótulo de evidência: "+data.evidenceStatus,
   "Vídeo: "+data.videoUrl,
   "Timestamp: "+data.timestamp,
   "Afirmação literal: "+data.quote,
   "Contexto: "+data.context,
   "Tipo: "+data.claimType,
   "Checagens jornalísticas:\n"+(data.journalismChecks.join("\n")||"Ainda não informado"),
   "Fontes primárias:\n"+(data.primarySources.join("\n")||"Ainda não informado"),
   "Fontes que sustentam:\n"+(data.supportingSources.join("\n")||"Ainda não informado"),"Fontes que contradizem/limitam:\n"+(data.contradictorySources.join("\n")||"Ainda não informado"),
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

 const statusNode=()=>byId("export-status");
 let editingClaimId=null;
 async function fetchJson(url, options={}) {
  const response=await fetch(url,{credentials:"same-origin",...options});
  let data={}; try { data=await response.json(); } catch {}
  if(!response.ok) throw new Error(data.error || "A solicitação não foi concluída.");
  return data;
 }
 async function csrfHeaders() {
  const result=await fetchJson("/api/csrf",{cache:"no-store"});
  return {"Content-Type":"application/json","X-CSRF-Token":result.csrfToken};
 }
 function makeText(tag,text,className) {
  const node=document.createElement(tag);node.textContent=text||"";
  if(className) node.className=className;return node;
 }
 async function loadPublishedClaims() {
  const root=byId("published-claims");
  try {
   const requestedTopic=new URLSearchParams(location.search).get("topic");const data=await fetchJson("/api/claims"+(requestedTopic?"?topic="+encodeURIComponent(requestedTopic):""),{cache:"no-store"});root.replaceChildren();
   if(!data.claims.length){root.append(makeText("p","Ainda não há checagens publicadas.","status-note"));return;}
   for(const claim of data.claims) {
    const card=makeText("article","");card.className="review-card";
    const evidenceLabels={confirmada_por_documento:"Confirmada por documento",contradita_por_documento:"Contradita por documento",sem_fonte:"Sem fonte suficiente",em_disputa:"Em disputa",documentada:"Fato documentado",alegacao:"Alegação",hipotese:"Hipótese",nao_verificado:"Não verificado"};
     card.append(makeText("h3",claim.speaker+" · "+(evidenceLabels[claim.evidence_status]||"Não verificado")));
     card.append(makeText("p",(claim.claim_date||"Data não informada")+" · Tema: "+(claim.topic||"outros"),"status-note"));
    card.append(makeText("p","“"+claim.quote+"”"));
    card.append(makeText("p",claim.context,"status-note"));
    if(claim.supporting_evidence)card.append(makeText("p","Evidência registrada: "+claim.supporting_evidence));if(claim.contradictory_evidence)card.append(makeText("p","Limitações registradas: "+claim.contradictory_evidence));
    const link=document.createElement("a");link.href=claim.video_url;link.target="_blank";link.rel="noopener noreferrer";
    link.textContent=claim.source_kind==="publicacao_x"?"Abrir publicação original no X":"Abrir vídeo original";
    card.append(link);
    const sourcesButton=actionButton("sources",claim.id,"Ver fontes registradas");
    sourcesButton.classList.remove("button-outline");card.append(sourcesButton);
    root.append(card);
   }
  } catch(error) {root.replaceChildren(makeText("p","Não foi possível carregar checagens publicadas: "+error.message,"status-note"));}
 }

 byId("published-claims").addEventListener("click",async(event)=>{
  const button=event.target.closest('button[data-claim-action="sources"]');
  if(!button)return;
  button.disabled=true;
  const card=button.closest("article");
  const existing=card.querySelector("[data-public-sources]");
  if(existing){existing.remove();button.textContent="Ver fontes registradas";button.disabled=false;return;}
  try {
   const detail=await fetchJson("/api/claims/"+encodeURIComponent(button.dataset.claimId),{cache:"no-store"});
   const box=makeText("div","");box.dataset.publicSources="true";
   box.append(makeText("h4","Fontes e referências"));
   const sources=detail.sources||[];
   if(!sources.length) box.append(makeText("p","Nenhuma fonte documental foi registrada para esta ficha.","status-note"));
   for(const source of sources){
    const item=makeText("div","");
    const title=source.title||source.publisher||source.url;
    const sourceLink=document.createElement("a");sourceLink.href=source.url;sourceLink.target="_blank";sourceLink.rel="noopener noreferrer";
    sourceLink.textContent=title;item.append(sourceLink);
    const sideLabel=source.side==="supports"?"Sustenta":source.side==="contradicts"?"Contradiz/limita":"Contextualiza";item.append(makeText("p",sideLabel+" · "+source.source_type+" · "+(source.notes||source.excerpt||"Link de referência"),"status-note"));
    box.append(item);
   }
   if(detail.claim.supporting_evidence)box.append(makeText("p","Evidência favorável: "+detail.claim.supporting_evidence));
   if(detail.claim.contradictory_evidence)box.append(makeText("p","Limitações/evidências contrárias: "+detail.claim.contradictory_evidence));
   if((detail.relations||[]).length) {
    box.append(makeText("h4","Checagens relacionadas"));
    for(const relation of detail.relations) {
     box.append(makeText("p",relation.relation_type+" · "+relation.speaker+": “"+relation.quote+"”"));
     if(relation.explanation)box.append(makeText("p",relation.explanation,"status-note"));
    }
   }
   card.append(box);button.textContent="Ocultar fontes";
  } catch(error) {
   statusNode().textContent="Não foi possível carregar as fontes da checagem: "+error.message;
  } finally {button.disabled=false;}
 });

 async function loadAdminQueue() {
  const panel=byId("admin-claims"),root=byId("admin-queue");
  try {
   const auth=await fetchJson("/api/auth/me",{cache:"no-store"});panel.hidden=!auth.isAdmin;
   if(!auth.isAdmin)return;
   const data=await fetchJson("/api/admin/claims",{cache:"no-store"});root.replaceChildren();
   if(!data.claims.length){root.append(makeText("p","A fila está vazia. Salve um rascunho para iniciar uma checagem.","status-note"));return;}
   for(const claim of data.claims) {
    const card=makeText("article","");card.className="review-card";
    card.append(makeText("h3",claim.speaker+" · "+claim.status));
    card.append(makeText("p","“"+claim.quote+"”"));
    card.append(makeText("p",claim.context,"status-note"));
    card.append(makeText("p","Material: "+(claim.source_kind==="publicacao_x"?"X":"vídeo")+" · Timestamp: "+(claim.timestamp||"não aplicável")));
    card.append(makeText("p","Sustentação: "+(claim.supporting_evidence||"não informada")+" · Limitações: "+(claim.contradictory_evidence||"não informadas")));
    const link=document.createElement("a");link.href=claim.video_url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Abrir material original";card.append(link);
    const actions=document.createElement("div");actions.className="button-row";
    if(claim.status!=="published"&&claim.status!=="approved") actions.append(actionButton("edit",claim.id,"Editar rascunho"));
    if(claim.status==="draft"||claim.status==="rejected") actions.append(actionButton("review",claim.id,"Iniciar revisão"));
     if(claim.status!=="published") actions.append(actionButton("ai-review",claim.id,"Pedir análise da IA"));
    if(claim.status==="in_review") {
     actions.append(actionButton("approve",claim.id,"Aprovar"));actions.append(actionButton("reject",claim.id,"Rejeitar"));
    }
    if(claim.status==="approved") actions.append(actionButton("publish",claim.id,"Publicar"));
     card.append(actions);
     const relationBox=makeText("div","");relationBox.className="review-card";relationBox.dataset.relationBox="true";
     relationBox.append(makeText("h4","Relacionar com outra checagem"));
     const target=document.createElement("select");target.dataset.relationTarget="true";
     const emptyOption=document.createElement("option");emptyOption.value="";emptyOption.textContent="Escolha uma ficha…";target.append(emptyOption);
     for(const other of data.claims.filter(item=>item.id!==claim.id)){
      const option=document.createElement("option");option.value=other.id;
      option.textContent=other.speaker+": "+String(other.quote||"").slice(0,90);target.append(option);
     }
     target.disabled=data.claims.length<2;relationBox.append(target);
     const relationType=document.createElement("select");relationType.dataset.relationType="true";
     for(const [value,label] of [["related","Relacionada"],["supports","Sustenta"],["contradicts","Contradiz"],["same_topic","Mesmo tema"],["contextualizes","Contextualiza"]]){
      const option=document.createElement("option");option.value=value;option.textContent=label;relationType.append(option);
     }
     relationBox.append(relationType);
     const explanation=document.createElement("textarea");explanation.dataset.relationExplanation="true";
     explanation.maxLength=1500;explanation.rows=2;explanation.placeholder="Explique por que as fichas se relacionam (opcional).";relationBox.append(explanation);
     const relationSave=document.createElement("button");relationSave.type="button";relationSave.className="button button-outline";
     relationSave.dataset.claimRelation=claim.id;relationSave.textContent="Salvar relação";relationSave.disabled=data.claims.length<2;relationBox.append(relationSave);
     card.append(relationBox);root.append(card);
   }
  } catch {panel.hidden=true;}
 }
 async function editClaim(id) {
  const data=await fetchJson("/api/admin/claims/"+encodeURIComponent(id),{cache:"no-store"});
  const claim=data.claim, sources=data.sources||[];
  editingClaimId=claim.id;
  byId("speaker").value=claim.speaker;byId("claim-date").value=claim.claim_date||"";byId("topic").value=claim.topic||"outros";byId("location").value=claim.location||"";byId("evidence-status").value=claim.evidence_status||"nao_verificado";
  const selectedVideo=claim.source_kind==="publicacao_x" ? "14" :
    (Object.entries(videoUrls).find(([,url])=>url===claim.video_url)?.[0] || "");
  byId("video-id").value=selectedVideo;
  byId("video-id").dispatchEvent(new Event("change"));
  byId("timestamp").value=claim.timestamp||"";
  byId("quote").value=claim.quote||"";
  byId("context-text").value=claim.context||"";
  byId("claim-type").value=claim.claim_type||"";
  byId("journalism").value=sources.filter(s=>s.source_type==="jornalistica").map(s=>s.url).join("\n");
  byId("primary").value=sources.filter(s=>s.source_type==="primaria").map(s=>s.url).join("\n");byId("supporting-sources").value=sources.filter(s=>s.side==="supports").map(s=>s.url).join("\n");byId("contradictory-sources").value=sources.filter(s=>s.side==="contradicts").map(s=>s.url).join("\n");
  byId("support").value=claim.supporting_evidence||"";
  byId("contradict").value=claim.contradictory_evidence||"";
  const labels={"verdadeira":"Verdadeira","falsa":"Falsa","enganosa":"Enganosa / imprecisa","fora_de_contexto":"Fora de contexto","inconclusiva":"Inconclusiva","opiniao_previsao":"Opinião / previsão — não verificável como fato","nao_verificada":"Não verificada"};
  byId("verdict").value=labels[claim.verdict]||"Não verificada";
  byId("explanation").value=claim.explanation||"";
  byId("save-record").textContent="Atualizar rascunho no banco";
  statusNode().textContent="Editando a ficha "+claim.id+". Ao atualizar, ela volta para rascunho privado e deverá passar pela revisão novamente.";
  byId("claim-form").scrollIntoView({behavior:"smooth",block:"start"});
 }
 function actionButton(action,id,label) {
  const button=document.createElement("button");button.type="button";button.className="button button-outline";
  button.dataset.claimAction=action;button.dataset.claimId=id;button.textContent=label;return button;
 }
 async function performAction(action,id) {
  const headers=await csrfHeaders();let url="/api/admin/claims/"+encodeURIComponent(id)+"/decision";
  let body={decision:({approve:"approved",reject:"rejected",publish:"published"}[action]||action)};
  if(action==="ai-review") { url="/api/admin/claims/"+encodeURIComponent(id)+"/ai-review";body={}; }
   if(action==="review") {
   url="/api/admin/claims/"+encodeURIComponent(id)+"/reviews";
   body={model:"manual-editorial-workflow",output:{event:"human_review_started",note:"A revisão humana foi iniciada pela interface; isso não significa que as fontes foram validadas."}};
  }
  await fetchJson(url,{method:"POST",headers,body:JSON.stringify(body)});
  await loadAdminQueue();if(action==="publish")await loadPublishedClaims();
 }
 byId("save-record").addEventListener("click",async()=>{
  const form=byId("claim-form");
  if(!form.reportValidity()){statusNode().textContent="Preencha pessoa, material, fala literal e contexto. Vídeos precisam de timestamp válido.";return;}
  const data=record();
  try {
   const auth=await fetchJson("/api/auth/me",{cache:"no-store"});
   if(!auth.isAdmin){statusNode().textContent="Para salvar no banco, entre na Área administrativa da página inicial e volte a esta ficha. Nada foi salvo ainda.";return;}
   const headers=await csrfHeaders();
   const isUpdate=Boolean(editingClaimId);
   const endpoint=isUpdate?("/api/admin/claims/"+encodeURIComponent(editingClaimId)):"/api/admin/claims";
   const saved=await fetchJson(endpoint,{method:isUpdate?"PUT":"POST",headers,body:JSON.stringify({
    speaker:data.speaker,claim_date:data.claimDate,topic:data.topic,location:data.location,evidence_status:data.evidenceStatus,video_url:data.videoUrl,source_kind:data.sourceKind,timestamp:data.timestamp,
    quote:data.quote,context:data.context,claim_type:data.claimType,verdict:data.provisionalClassification,
    explanation:data.explanation,supporting_evidence:data.supportingEvidence,
    contradictory_evidence:data.contradictoryEvidence,journalism_checks:data.journalismChecks,
    primary_sources:data.primarySources,supporting_sources:data.supportingSources,contradictory_sources:data.contradictorySources
   })});
   statusNode().textContent=(isUpdate?"Rascunho atualizado: ":"Rascunho salvo: ")+saved.id+". Está privado e deverá passar pela revisão editorial.";
   editingClaimId=null;byId("save-record").textContent="Salvar rascunho no banco (requer login)";
   await loadAdminQueue();
  } catch(error) {statusNode().textContent="Não foi possível salvar o rascunho: "+error.message;}
 });
 byId("admin-queue").addEventListener("click",async(event)=>{
  const relationButton=event.target.closest("button[data-claim-relation]");
  if(relationButton){
   const box=relationButton.closest("[data-relation-box]");
   const relatedId=box?.querySelector("[data-relation-target]")?.value||"";
   const relationType=box?.querySelector("[data-relation-type]")?.value||"related";
   const explanation=box?.querySelector("[data-relation-explanation]")?.value.trim()||"";
   if(!relatedId){statusNode().textContent="Escolha outra ficha antes de salvar a relação.";return;}
   relationButton.disabled=true;
   try{
    const headers=await csrfHeaders();
    await fetchJson("/api/admin/claims/"+encodeURIComponent(relationButton.dataset.claimRelation)+"/relations",{
     method:"POST",headers,body:JSON.stringify({related_claim_id:relatedId,relation_type:relationType,explanation})
    });
    statusNode().textContent="Relação entre checagens registrada.";
    await loadAdminQueue();
   }catch(error){statusNode().textContent="Não foi possível registrar a relação: "+error.message;}
   finally{relationButton.disabled=false;}
   return;
  }
  const button=event.target.closest("button[data-claim-action]");if(!button)return;button.disabled=true;
  try {
   if(button.dataset.claimAction==="edit") await editClaim(button.dataset.claimId);
   else {await performAction(button.dataset.claimAction,button.dataset.claimId);statusNode().textContent="Ação editorial registrada. Confira novamente fontes e contexto antes da publicação.";}
  } catch(error){statusNode().textContent="A ação não foi concluída: "+error.message;}
  finally{button.disabled=false;}
 });
 byId("video-id").addEventListener("change",()=>{
  const isX=byId("video-id").value==="14";
  byId("timestamp").placeholder=isX?"Publicação no X: deixe em branco":"Vídeo: 00:12:34";byId("timestamp").required=!isX;
  const label=document.querySelector('label[for="video-id"]');if(label)label.textContent=isX?"Publicação de origem":"Vídeo de origem";
 });
 loadPublishedClaims();loadAdminQueue();

})();
