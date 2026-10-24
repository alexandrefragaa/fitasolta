"use strict";
(() => {
  const CONSENT_KEY = "fitasolta-analytics-consent";
  const NOTICE_KEY = "fitasolta-cookie-notice-dismissed";
  const publicPaths = new Set(["/", "/index.html", "/debates.html", "/comparar.html", "/votacao.html"]);
  let csrfToken = "";
  function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; }
  async function csrf() {
    if (csrfToken) return csrfToken;
    const r=await fetch("/api/csrf",{credentials:"same-origin",cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    if(!r.ok||!b.csrfToken)throw new Error("CSRF indisponível");
    csrfToken=b.csrfToken;return csrfToken;
  }
  async function send(event, resource) {
    try {
      const allowed=["page_view","search","claim_view"];
      if(!allowed.includes(event))return;
      await csrf();
      await fetch("/api/analytics",{method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json","X-CSRF-Token":csrfToken},
        body:JSON.stringify({event,resource})});
    } catch { /* falha de métricas nunca interfere no site */ }
  }
  function currentResource() {
    const pathname=location.pathname==="/index.html"?"/":location.pathname;
    return publicPaths.has(pathname)?pathname:"";
  }
  function reportCurrentClaim() {
    const match=/^#claim-([a-f0-9-]{20,80})$/i.exec(location.hash);
    if(match)send("claim_view","claim:"+match[1]);
  }
  function setChoice(choice) {
    try { localStorage.setItem(CONSENT_KEY,choice); } catch {}
    const notice=document.getElementById("cookie-notice")||document.getElementById("analytics-consent");
    if(notice)notice.hidden=true;
    if(choice==="yes"&&currentResource())send("page_view",currentResource());
  }
  function makeNotice() {
    let notice=document.getElementById("cookie-notice");
    if(!notice) {
      notice=el("aside","analytics-consent");notice.id="analytics-consent";
      notice.setAttribute("role","region");notice.setAttribute("aria-label","Preferências de métricas");
      document.body.appendChild(notice);
    }
    let p=notice.querySelector("p");
    if(!p){p=el("p");notice.appendChild(p);}
    p.textContent="Métricas opcionais: podemos contar visualizações por página, buscas sem guardar o texto pesquisado e acessos agregados às fichas. Não registramos IP, perfil ou identificador de visitante na tabela de métricas. Aceitar é opcional.";
    const accept=el("button","button","Ativar métricas anônimas");accept.type="button";accept.id="analytics-accept";
    const decline=notice.querySelector("#cookie-dismiss")||el("button","button button-outline","Não ativar");
    decline.type="button";
    if(!decline.id)decline.id="analytics-decline";
    let actions=notice.querySelector(".analytics-actions");
    if(!actions){actions=el("div","analytics-actions");notice.appendChild(actions);}
    actions.replaceChildren(accept,decline);
    accept.addEventListener("click",()=>setChoice("yes"));
    decline.addEventListener("click",()=>setChoice("no"));
    let choice="";
    try{choice=localStorage.getItem(CONSENT_KEY)||"";}catch{}
    if(!choice){
      try{if(localStorage.getItem("tc-analytics-consent")==="yes")choice="yes";}catch{}
    }
    notice.hidden=!!choice;
    if(choice==="yes"&&currentResource())send("page_view",currentResource());
  }
  window.tcAnalytics = Object.freeze({
    count(name) {
      if (name === "search") send("search", "/debates.html");
      else if (name === "page_view") send("page_view", currentResource());
    },
    enableLocalAnalytics() { setChoice("yes"); },
    disableLocalAnalytics() { setChoice("no"); },
    snapshot() { return { mode: "optional-anonymous-aggregates" }; }
  });
  function init() {
    makeNotice();
    if(currentResource()==="/" && document.getElementById("search-button")) {
      document.getElementById("search-button").addEventListener("click",()=>{if(localStorageSafe())send("search","/");});
    }
    const term=document.getElementById("filter-search");
    if(term)term.addEventListener("change",()=>{if(localStorageSafe())send("search","/debates.html");});
    if(localStorageSafe()&&currentResource())reportCurrentClaim();
    window.addEventListener("hashchange",()=>{if(localStorageSafe()&&currentResource())reportCurrentClaim();});
  }
  function localStorageSafe(){try{return localStorage.getItem(CONSENT_KEY)==="yes"||localStorage.getItem("tc-analytics-consent")==="yes";}catch{return false;}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();