"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let csrfToken = "";
  let isAdmin = false;
  let casesCache = [];
  let peopleCache = [];
  let claimsCache = [];
  let editingCaseId = "";
  let editingPersonId = "";
  let editingClipId = "";

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || "A solicitação não foi concluída.");
    return data;
  }
  async function getCsrf() {
    const result = await api("/api/csrf");
    csrfToken = result.csrfToken || "";
    return csrfToken;
  }
  async function sendJson(url, method, body) {
    if (!csrfToken) await getCsrf();
    return api(url, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify(body)
    });
  }
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function addLink(parent, url, text) {
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      const link = el("a", text || parsed.href, "source-link");
      link.href = parsed.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.append(link);
    } catch {}
  }
  function setStatus(id, message, error = false) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(error));
  }
  function statusLabel(value) {
    return ({
      draft: "Rascunho", in_review: "Em revisão", approved: "Aprovado",
      published: "Publicado", rejected: "Rejeitado", withdrawn: "Retirado",
      triagem: "Triagem", apuracao_preliminar: "Apuração preliminar",
      investigacao_em_andamento: "Investigação em andamento",
      denuncia_oferecida: "Denúncia oferecida", denuncia_recebida: "Denúncia recebida",
      processo_em_curso: "Processo em curso", decisao: "Decisão", recurso: "Recurso",
      arquivado: "Arquivado", encerrado: "Encerrado", desconhecido: "Desconhecido",
      nao_verificado: "Não verificado", documentado: "Documentado",
      fato_documentado: "Fato documentado", alegacao: "Alegação", hipotese: "Hipótese"
    })[value] || value || "Não informado";
  }
  function timestampSeconds(value) {
    if (typeof value !== "string" || !/^([0-9]{1,2}:)?[0-5][0-9]:[0-5][0-9]$/.test(value)) return null;
    const parts = value.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }
  function videoAt(url, seconds) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;
      if (parsed.hostname === "youtu.be" || parsed.hostname.endsWith(".youtube.com") || parsed.hostname === "youtube.com") {
        parsed.searchParams.set("t", String(seconds) + "s");
        return parsed.href;
      }
      return parsed.href;
    } catch { return url; }
  }
  function workflowActions(type, record) {
    const box = el("div", undefined, "card-actions");
    const steps = {
      draft: ["in_review", "Enviar para revisão"],
      rejected: ["in_review", "Reenviar para revisão"],
      in_review: ["approved", "Aprovar"],
      approved: ["published", "Publicar"],
      published: ["withdrawn", "Retirar"]
    };
    const next = steps[record.editorial_status || record.status];
    if (!next) return box;
    const button = el("button", next[1], "button button-small");
    button.type = "button";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await sendJson(decisionEndpoint(type, record.id), "POST", { decision: next[0] });
        await refreshAll();
      } catch (error) {
        setStatus("editorial-status", error.message, true);
        button.disabled = false;
      }
    });
    box.append(button);
    return box;
  }
  function decisionEndpoint(type, id) {
    const prefix = {
      case: "/api/admin/cases/",
      person: "/api/admin/people/",
      role: "/api/admin/case-people/",
      event: "/api/admin/case-events/",
      clip: "/api/admin/clips/",
      relation: "/api/admin/claim-relations/"
    }[type];
    const suffix = type === "case" || type === "person" || type === "clip" || type === "relation" ? "/decision" : "/decision";
    return prefix + encodeURIComponent(id) + suffix;
  }
  function recordCard(title, status, detail) {
    const card = el("article", undefined, "investigation-card");
    const head = el("div", undefined, "investigation-card-head");
    head.append(el("h3", title || "Registro sem título"));
    head.append(el("span", statusLabel(status), "status-pill status-" + (status || "unknown")));
    card.append(head);
    if (detail) card.append(el("p", detail));
    return card;
  }
  function renderEmpty(root, message) {
    root.replaceChildren(el("p", message, "status-note"));
  }
  function renderCases(items) {
    const root = $("#public-cases");
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, "Nenhum caso publicado.");
    for (const item of items) {
      const card = recordCard(item.title, item.status, item.summary);
      card.append(el("p", "Categoria: " + statusLabel(item.category) + " · Estado editorial: publicado", "muted"));
      if (item.jurisdiction) card.append(el("p", "Jurisdição: " + item.jurisdiction));
      if (item.responsible_agency) card.append(el("p", "Órgão responsável: " + item.responsible_agency));
      if (item.official_reference) card.append(el("p", "Referência oficial: " + item.official_reference));
      addLink(card, item.source_url, "Abrir fonte principal");
      const details = el("button", "Ver pessoas, andamentos e cortes", "button button-outline button-small");
      details.type = "button";
      const detailRoot = el("div", undefined, "case-detail");
      details.addEventListener("click", async () => {
        if (!detailRoot.hidden) { detailRoot.hidden = true; return; }
        detailRoot.hidden = false;
        detailRoot.replaceChildren(el("p", "Carregando detalhes…", "status-note"));
        try {
          const detail = await api("/api/cases/" + encodeURIComponent(item.id));
          detailRoot.replaceChildren();
          const peopleHeading = el("h4", "Pessoas e papéis documentados");
          detailRoot.append(peopleHeading);
          if (!detail.people.length) detailRoot.append(el("p", "Nenhum vínculo publicado.", "status-note"));
          for (const person of detail.people) {
            detailRoot.append(el("p", person.name + " — " + statusLabel(person.role) + (person.role_description ? ": " + person.role_description : "")));
            addLink(detailRoot, person.source_url, "Fonte do vínculo");
          }
          detailRoot.append(el("h4", "Linha do tempo"));
          if (!detail.events.length) detailRoot.append(el("p", "Nenhum andamento publicado.", "status-note"));
          for (const event of detail.events) {
            detailRoot.append(el("p", (event.event_date || event.document_date || event.published_date || "") + " — " + event.title + (event.description ? ": " + event.description : "")));
            addLink(detailRoot, event.source_url, "Fonte do andamento");
          }
          if (detail.claims.length) {
            detailRoot.append(el("h4", "Checagens associadas"));
            for (const claim of detail.claims) {
              detailRoot.append(el("p", claim.speaker + ": “" + claim.quote + "” — " + statusLabel(claim.verdict)));
              addLink(detailRoot, claim.video_url, "Material original");
            }
          }
          if (detail.clips.length) {
            detailRoot.append(el("h4", "Cortes publicados"));
            for (const clip of detail.clips) {
              detailRoot.append(el("p", clip.title + " · " + clip.start_timestamp + "–" + clip.end_timestamp));
              addLink(detailRoot, videoAt(clip.video_url, clip.start_seconds || 0), "Abrir vídeo no início do trecho");
            }
          }
        } catch (error) {
          detailRoot.replaceChildren(el("p", error.message, "status error"));
        }
      });
      card.append(details, detailRoot);
      detailRoot.hidden = true;
      root.append(card);
    }
  }
  function renderPeople(items) {
    const root = $("#public-people");
    root.replaceChildren();
    const visible = items.filter(item => ["person","organization","institution"].includes(String(item.type).toLowerCase()));
    if (!visible.length) return renderEmpty(root, "Nenhuma ficha de pessoa ou organização publicada.");
    for (const person of visible) {
      const card = recordCard(person.name, "published", person.description);
      card.append(el("p", "Tipo: " + person.type));
      if (person.source_date) card.append(el("p", "Data da fonte: " + person.source_date));
      addLink(card, person.source_url, "Fonte da ficha");
      root.append(card);
    }
  }
  function renderContradictions(items) {
    const root = $("#public-contradictions");
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, "Nenhuma contradição revisada e publicada.");
    for (const item of items) {
      const card = recordCard("Contradição documentada", "published", item.explanation);
      const grid = el("div", undefined, "comparison-grid");
      const a = el("section", undefined, "comparison-side");
      a.append(el("h3", item.speaker_a || "Pessoa não informada"));
      a.append(el("blockquote", "“" + item.quote_a + "”"));
      a.append(el("p", "Classificação: " + statusLabel(item.verdict_a)));
      addLink(a, videoAt(item.video_a, timestampSeconds(item.timestamp_a) || 0), "Abrir primeira fonte");
      const b = el("section", undefined, "comparison-side");
      b.append(el("h3", item.speaker_b || "Pessoa não informada"));
      b.append(el("blockquote", "“" + item.quote_b + "”"));
      b.append(el("p", "Classificação: " + statusLabel(item.verdict_b)));
      addLink(b, videoAt(item.video_b, timestampSeconds(item.timestamp_b) || 0), "Abrir segunda fonte");
      grid.append(a,b);
      card.append(grid);
      root.append(card);
    }
  }
  function renderClips(items, rootSelector) {
    const root = $(rootSelector);
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, rootSelector === "#public-clips" ? "Nenhum corte publicado." : "Nenhum corte cadastrado.");
    for (const clip of items) {
      const card = recordCard(clip.title, clip.editorial_status || "published", clip.quote || "Sem citação literal");
      card.append(el("p", "Intervalo: " + clip.start_timestamp + "–" + clip.end_timestamp));
      if (clip.context_before) card.append(el("p", "Antes: " + clip.context_before));
      if (clip.context_after) card.append(el("p", "Depois: " + clip.context_after));
      if (clip.notes) card.append(el("p", clip.notes, "muted"));
      addLink(card, videoAt(clip.video_url, clip.start_seconds || timestampSeconds(clip.start_timestamp) || 0), "Abrir vídeo original no trecho");
      if (rootSelector === "#admin-clips") {
        if (["draft","in_review","rejected"].includes(clip.editorial_status)) {
          const edit = el("button", "Editar rascunho", "button button-outline button-small");
          edit.type = "button";
          edit.addEventListener("click", () => {
            editingClipId = clip.id;
            const form = $("#clip-form");
            for (const name of ["title","video_url","start_timestamp","end_timestamp","quote","context_before","context_after","notes","case_id","claim_id"]) {
              if (form.elements[name]) form.elements[name].value = clip[name] || "";
            }
            form.querySelector("button[type=submit]").textContent = "Atualizar rascunho do corte";
            form.scrollIntoView({behavior:"smooth",block:"start"});
          });
          card.append(edit);
        }
        card.append(workflowActions("clip", clip));
      }
      root.append(card);
    }
  }
  async function refreshPublic(section) {
    if (!section || section === "cases") {
      const data = await api("/api/cases");
      renderCases(data.cases || []);
    }
    if (!section || section === "people") {
      const data = await api("/api/entities");
      renderPeople(data.entities || []);
    }
    if (!section || section === "contradictions") {
      const data = await api("/api/contradictions");
      renderContradictions(data.contradictions || []);
    }
    if (!section || section === "clips") {
      const data = await api("/api/clips");
      renderClips(data.clips || [], "#public-clips");
    }
  }
  function fillSelect(selector, options, placeholder) {
    const select = $(selector);
    if (!select) return;
    const oldValue = select.value;
    select.replaceChildren();
    if (placeholder) select.append(new Option(placeholder, ""));
    for (const item of options) select.append(new Option(item.label, item.value));
    if (options.some(item => item.value === oldValue)) select.value = oldValue;
  }
  async function loadEditor() {
    if (!isAdmin) return;
    const [caseData, peopleData, claimData, clipData, relationData] = await Promise.all([
      api("/api/admin/cases"),
      api("/api/admin/people"),
      api("/api/admin/claims"),
      api("/api/admin/clips"),
      api("/api/admin/claim-relations")
    ]);
    casesCache = caseData.cases || [];
    peopleCache = peopleData.people || [];
    claimsCache = claimData.claims || [];
    renderAdminCases(casesCache);
    renderAdminPeople(peopleCache);
    const detailedCases = await Promise.all(casesCache.map(async (item) => {
      try {
        const detail = await api("/api/admin/cases/" + encodeURIComponent(item.id));
        return { ...item, people: detail.people || [], events: detail.events || [], claims: detail.claims || [], clips: detail.clips || [] };
      } catch {
        return { ...item, people: [], events: [], claims: [], clips: [] };
      }
    }));
    renderAdminCaseDetails(detailedCases);
    renderClips(clipData.clips || [], "#admin-clips");
    renderRelations(relationData.relations || []);
    fillSelect("#role-case", casesCache.map(x => ({value:x.id,label:x.title + " [" + statusLabel(x.editorial_status) + "]"})), "Selecione um caso");
    fillSelect("#event-case", casesCache.map(x => ({value:x.id,label:x.title + " [" + statusLabel(x.editorial_status) + "]"})), "Selecione um caso");
    fillSelect("#clip-case", casesCache.map(x => ({value:x.id,label:x.title})), "Sem caso associado");
    fillSelect("#role-person", peopleCache.map(x => ({value:x.id,label:x.name + " [" + statusLabel(x.editorial_status) + "]"})), "Selecione uma pessoa");
    fillSelect("#case-claim-case", casesCache.map(x => ({value:x.id,label:x.title + " [" + statusLabel(x.editorial_status) + "]"})), "Selecione um caso");
    fillSelect("#case-claim-claim", claimsCache.map(x => ({value:x.id,label:x.speaker + ": " + x.quote.slice(0,70) + " [" + statusLabel(x.status) + "]"})), "Selecione uma checagem");
    fillSelect("#clip-claim", claimsCache.map(x => ({value:x.id,label:x.speaker + ": " + x.quote.slice(0,70)})), "Sem checagem associada");
    fillSelect("#relation-first", claimsCache.map(x => ({value:x.id,label:x.speaker + ": " + x.quote.slice(0,70) + " [" + statusLabel(x.status) + "]"})), "Selecione a primeira checagem");
    fillSelect("#relation-second", claimsCache.map(x => ({value:x.id,label:x.speaker + ": " + x.quote.slice(0,70) + " [" + statusLabel(x.status) + "]"})), "Selecione a segunda checagem");
  }
  function renderAdminCases(items) {
    const root = $("#admin-cases");
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, "Nenhum caso cadastrado.");
    for (const item of items) {
      const card = recordCard(item.title, item.editorial_status, item.summary);
      card.append(el("p", "Estado operacional: " + statusLabel(item.status)));
      addLink(card, item.source_url, "Fonte do caso");
      if (["draft","in_review","rejected"].includes(item.editorial_status)) {
        const edit = el("button", "Editar rascunho", "button button-outline button-small");
        edit.type = "button";
        edit.addEventListener("click", () => {
          editingCaseId = item.id;
          const form = $("#case-form");
          for (const name of ["title","summary","category","jurisdiction","responsible_agency","official_reference","source_url","status","opened_at","last_checked_at","next_review_at"]) {
            if (form.elements[name]) form.elements[name].value = item[name] || "";
          }
          form.querySelector("button[type=submit]").textContent = "Atualizar rascunho do caso";
          form.scrollIntoView({behavior:"smooth",block:"start"});
        });
        card.append(edit);
      }
      card.append(workflowActions("case", item));
      root.append(card);
    }
  }
  function renderAdminPeople(items) {
    const root = $("#admin-people");
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, "Nenhuma ficha cadastrada.");
    for (const item of items) {
      const card = recordCard(item.name, item.editorial_status, item.description);
      addLink(card, item.source_url, "Fonte da ficha");
      if (["draft","in_review","rejected"].includes(item.editorial_status)) {
        const edit = el("button", "Editar rascunho", "button button-outline button-small");
        edit.type = "button";
        edit.addEventListener("click", () => {
          editingPersonId = item.id;
          const form = $("#person-form");
          for (const name of ["name","type","description","source_url","source_date","evidence_status"]) {
            if (form.elements[name]) form.elements[name].value = item[name] || "";
          }
          form.querySelector("button[type=submit]").textContent = "Atualizar rascunho da ficha";
          form.scrollIntoView({behavior:"smooth",block:"start"});
        });
        card.append(edit);
      }
      card.append(workflowActions("person", item));
      root.append(card);
    }
  }
  function renderAdminCaseDetails(items) {
    const root = $("#admin-case-details");
    root.replaceChildren();
    let count = 0;
    for (const item of items) {
      for (const person of item.people || []) {
        const card = recordCard(item.title + " — " + person.name + " (" + statusLabel(person.role) + ")", person.editorial_status, person.role_description);
        addLink(card, person.source_url, "Fonte do vínculo");
        card.append(workflowActions("role", person));
        root.append(card);
        count += 1;
      }
      for (const event of item.events || []) {
        const card = recordCard(item.title + " — " + event.title, event.editorial_status, event.description);
        addLink(card, event.source_url, "Fonte do andamento");
        card.append(workflowActions("event", event));
        root.append(card);
        count += 1;
      }
    }
    if (!count) renderEmpty(root, "Nenhum vínculo ou andamento cadastrado.");
  }
  function renderRelations(items) {
    const root = $("#admin-relations");
    root.replaceChildren();
    if (!items.length) return renderEmpty(root, "Nenhuma relação entre checagens cadastrada.");
    for (const item of items) {
      const type = item.relation_type === "contradicts" ? "Contradição" : "Relação: " + item.relation_type;
      const card = recordCard(type, item.editorial_status, item.explanation);
      card.append(el("p", (item.speaker_a || "") + ": “" + item.quote_a + "”"));
      card.append(el("p", (item.speaker_b || "") + ": “" + item.quote_b + "”"));
      card.append(workflowActions("relation", item));
      root.append(card);
    }
  }
  async function refreshAll() {
    await refreshPublic();
    if (isAdmin) await loadEditor();
  }
  function formBody(form) {
    const body = {};
    for (const [key, value] of new FormData(form).entries()) body[key] = String(value).trim();
    return body;
  }
  async function handleSubmit(form, endpoint, method, statusId) {
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const body = formBody(form);
      await sendJson(endpoint, method, body);
      setStatus(statusId, method === "PUT" ? "Rascunho atualizado." : "Rascunho salvo.");
      form.reset();
      if (form.id === "case-form") { editingCaseId = ""; button.textContent = "Salvar rascunho do caso"; }
      if (form.id === "person-form") { editingPersonId = ""; button.textContent = "Salvar rascunho da ficha"; }
      if (form.id === "clip-form") { editingClipId = ""; button.textContent = "Salvar corte em rascunho"; }
      await refreshAll();
    } catch (error) {
      setStatus(statusId, error.message, true);
    } finally {
      button.disabled = false;
    }
  }
  function initTabs() {
    $$(".investigation-tabs [data-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        if (target === "editorial" && !isAdmin) return;
        $$(".investigation-tabs [data-tab]").forEach(other => other.setAttribute("aria-selected", String(other === button)));
        $$("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== target; });
      });
    });
    $$("[data-refresh]").forEach(button => button.addEventListener("click", async () => {
      try { await refreshPublic(button.dataset.refresh); } catch (error) { console.error(error); }
    }));
  }
  async function checkAdmin() {
    try {
      const auth = await api("/api/auth/me");
      isAdmin = auth.isAdmin === true;
    } catch { isAdmin = false; }
    $("#editorial-tab").hidden = !isAdmin;
    $("#admin-open").textContent = isAdmin ? "Sair da área editorial" : "Área administrativa";
    if (isAdmin) {
      $("#panel-editorial").hidden = false;
      await loadEditor();
    } else {
      $("#panel-editorial").hidden = true;
      if ($("#editorial-tab").getAttribute("aria-selected") === "true") {
        $("[data-tab=cases]").click();
      }
    }
  }
  function initAuth() {
    const dialog = $("#admin-dialog");
    $("#admin-open").addEventListener("click", async () => {
      if (isAdmin) {
        try {
          await sendJson("/api/auth/logout", "POST", {});
          csrfToken = "";
          isAdmin = false;
          await checkAdmin();
          await refreshAll();
        } catch (error) {
          setStatus("editorial-status", error.message, true);
        }
      } else {
        setStatus("login-status", "");
        if (!csrfToken) await getCsrf();
        dialog.showModal();
      }
    });
    $("#admin-cancel").addEventListener("click", () => dialog.close());
    $("#login-form").addEventListener("submit", async event => {
      event.preventDefault();
      const password = $("#admin-password").value;
      try {
        await getCsrf();
        const result = await sendJson("/api/auth/login", "POST", { password });
        csrfToken = result.csrfToken || "";
        $("#admin-password").value = "";
        dialog.close();
        await checkAdmin();
        await refreshAll();
        $("[data-tab=editorial]").click();
      } catch (error) {
        setStatus("login-status", error.message, true);
      }
    });
    $("#admin-logout").addEventListener("click", () => $("#admin-open").click());
  }
  function initForms() {
    $("#case-form").addEventListener("submit", event => {
      event.preventDefault();
      handleSubmit(event.currentTarget, editingCaseId ? "/api/admin/cases/" + encodeURIComponent(editingCaseId) : "/api/admin/cases", editingCaseId ? "PUT" : "POST", "case-form-status");
    });
    $("#person-form").addEventListener("submit", event => {
      event.preventDefault();
      handleSubmit(event.currentTarget, editingPersonId ? "/api/admin/people/" + encodeURIComponent(editingPersonId) : "/api/admin/people", editingPersonId ? "PUT" : "POST", "person-form-status");
    });
    $("#role-form").addEventListener("submit", async event => {
      event.preventDefault();
      const body = formBody(event.currentTarget);
      const caseId = body.case_id;
      delete body.case_id;
      try {
        await sendJson("/api/admin/cases/" + encodeURIComponent(caseId) + "/people", "POST", body);
        setStatus("role-form-status", "Vínculo criado como rascunho.");
        event.currentTarget.reset();
        await refreshAll();
      } catch (error) { setStatus("role-form-status", error.message, true); }
    });
    $("#case-claim-form").addEventListener("submit", async event => {
      event.preventDefault();
      const body = formBody(event.currentTarget);
      const caseId = body.case_id;
      delete body.case_id;
      const claimId = body.claim_id;
      delete body.claim_id;
      try {
        await sendJson("/api/admin/cases/" + encodeURIComponent(caseId) + "/claims", "POST", { claim_id: claimId });
        setStatus("case-claim-form-status", "Checagem vinculada ao caso. O vínculo não foi publicado automaticamente.");
        event.currentTarget.reset();
        await refreshAll();
      } catch (error) { setStatus("case-claim-form-status", error.message, true); }
    });
    $("#event-form").addEventListener("submit", async event => {
      event.preventDefault();
      const body = formBody(event.currentTarget);
      const caseId = body.case_id;
      delete body.case_id;
      try {
        await sendJson("/api/admin/cases/" + encodeURIComponent(caseId) + "/events", "POST", body);
        setStatus("event-form-status", "Andamento criado como rascunho.");
        event.currentTarget.reset();
        await refreshAll();
      } catch (error) { setStatus("event-form-status", error.message, true); }
    });
    $("#clip-form").addEventListener("submit", event => {
      event.preventDefault();
      handleSubmit(event.currentTarget, editingClipId ? "/api/admin/clips/" + encodeURIComponent(editingClipId) : "/api/admin/clips", editingClipId ? "PUT" : "POST", "clip-form-status");
    });
    $("#relation-form").addEventListener("submit", async event => {
      event.preventDefault();
      const body = formBody(event.currentTarget);
      const claimId = body.claim_id;
      delete body.claim_id;
      try {
        if (claimId === body.related_claim_id) throw new Error("Escolha duas checagens diferentes.");
        await sendJson("/api/admin/claims/" + encodeURIComponent(claimId) + "/relations", "POST", body);
        setStatus("relation-form-status", "Relação criada como rascunho. Ela só aparecerá publicamente após revisão, aprovação e publicação.");
        event.currentTarget.reset();
        await refreshAll();
      } catch (error) { setStatus("relation-form-status", error.message, true); }
    });
  }
  async function init() {
    initTabs();
    initAuth();
    initForms();
    try { await refreshPublic(); } catch (error) { console.error(error); }
    try { await checkAdmin(); } catch (error) { console.error(error); }
  }
  init();
})();
