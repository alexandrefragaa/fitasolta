"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { entities: [], relationships: [], claims: [], selected: "" };
  const labels = {
    documentado: "Documentado", confirmada_por_documento: "Confirmado por documento",
    contradita_por_documento: "Contradito por documento", sem_fonte: "Sem fonte suficiente",
    alegacao: "Alegação", hipotese: "Hipótese", nao_verificado: "Não verificado",
    em_disputa: "Em disputa", verdadeira: "Verdadeira", falsa: "Falsa",
    enganosa: "Enganosa / imprecisa", inconclusiva: "Inconclusiva",
    person: "Pessoa", pessoa: "Pessoa", organization: "Organização", organizacao: "Organização",
    case: "Caso", caso: "Caso", place: "Local", local: "Local", event: "Evento", evento: "Evento"
  };
  const el = (tag, value, cls) => {
    const node = document.createElement(tag);
    if (value !== undefined && value !== null) node.textContent = String(value);
    if (cls) node.className = cls;
    return node;
  };
  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  };
  const addLink = (parent, href, label) => {
    const url = safeUrl(href);
    if (!url) return;
    const a = el("a", label || url, "source-link");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    parent.appendChild(a);
  };
  const evidenceLabel = (value) => labels[value] || value || "Não verificado";
  const dateLabel = (value) => {
    if (!value) return "Data não informada";
    const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
    return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d);
  };
  const seconds = (value) => {
    if (!value) return null;
    const parts = String(value).split(":").map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
    if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  };
  const claimUrl = (claim) => {
    const safe = safeUrl(claim.source_url);
    if (!safe) return "";
    try {
      const u = new URL(safe);
      const sec = seconds(claim.timestamp);
      if (sec !== null && claim.source_type !== "publicacao_x") u.searchParams.set("t", String(sec) + "s");
      return u.href;
    } catch { return safe; }
  };
  async function getJson(path) {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados.");
    return body;
  }
  function fillTypeFilter() {
    const select = $("entity-type");
    const types = [...new Set(state.entities.map((e) => e.type).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    for (const type of types) select.add(new Option(labels[type] || type, type));
  }
  function filteredEntities() {
    const q = $("entity-search").value.trim().toLocaleLowerCase("pt-BR");
    const type = $("entity-type").value;
    const status = $("entity-status").value;
    return state.entities.filter((entity) => {
      const relationText = state.relationships.filter((r) => r.source_id === entity.id || r.target_id === entity.id)
        .map((r) => r.label + " " + r.description).join(" ");
      const haystack = [entity.name, entity.description, relationText].join(" ").toLocaleLowerCase("pt-BR");
      return (!q || haystack.includes(q)) && (!type || entity.type === type) && (!status || entity.evidence_status === status);
    });
  }
  function renderEntities() {
    const root = $("entity-list");
    root.replaceChildren();
    const items = filteredEntities();
    $("network-status").textContent = items.length + " ficha(s) encontrada(s). As conexões exibem apenas relações cadastradas.";
    if (!items.length) {
      root.appendChild(el("p", "Nenhuma ficha corresponde aos filtros. Cadastros públicos aparecerão aqui quando existirem.", "empty-state"));
      return;
    }
    for (const entity of items) {
      const card = el("article", undefined, "entity-card");
      card.setAttribute("aria-current", entity.id === state.selected ? "true" : "false");
      card.appendChild(el("p", (labels[entity.type] || entity.type || "Registro") + " · " + evidenceLabel(entity.evidence_status), "entity-meta"));
      card.appendChild(el("h3", entity.name));
      if (entity.description) card.appendChild(el("p", entity.description));
      card.appendChild(el("p", "Fonte atualizada: " + dateLabel(entity.source_date), "entity-meta"));
      const button = el("button", "Abrir conexões", "button button-outline");
      button.type = "button";
      button.addEventListener("click", () => {
        state.selected = entity.id;
        renderEntities();
        renderDetail(entity).catch((error) => {
          $("entity-detail").replaceChildren(el("p", error.message, "empty-state"));
        });
      });
      card.appendChild(button);
      addLink(card, entity.source_url, "Abrir fonte da ficha");
      root.appendChild(card);
    }
  }
  function renderDetail(entity) {
    const root = $("entity-detail");
    root.replaceChildren();
    root.appendChild(el("p", (labels[entity.type] || entity.type || "Registro") + " · " + evidenceLabel(entity.evidence_status), "entity-meta"));
    root.appendChild(el("h3", entity.name));
    if (entity.description) root.appendChild(el("p", entity.description));
    addLink(root, entity.source_url, "Fonte principal");
    const related = state.relationships.filter((r) => r.source_id === entity.id || r.target_id === entity.id);
    root.appendChild(el("h4", "Conexões documentadas"));
    if (!related.length) root.appendChild(el("p", "Nenhuma relação cadastrada.", "empty-state"));
    for (const relation of related) {
      const otherId = relation.source_id === entity.id ? relation.target_id : relation.source_id;
      const other = state.entities.find((e) => e.id === otherId);
      const row = el("div", undefined, "relation-row");
      row.appendChild(el("strong", other ? other.name : "Registro relacionado"));
      row.appendChild(el("p", (relation.label || relation.relation_type || "Relação") + " · " + evidenceLabel(relation.evidence_status)));
      if (relation.description) row.appendChild(el("p", relation.description));
      row.appendChild(el("p", "Data da fonte: " + dateLabel(relation.source_date), "entity-meta"));
      addLink(row, relation.source_url, "Conferir fonte da relação");
      if (other) {
        const open = el("button", "Abrir ficha", "button button-outline");
        open.type = "button";
        open.addEventListener("click", () => {
          state.selected = other.id;
          renderEntities();
          renderDetail(other).catch((error) => { root.replaceChildren(el("p", error.message)); });
          root.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        row.appendChild(open);
      }
      root.appendChild(row);
    }
    root.appendChild(el("h4", "Linha do tempo"));
    const events = related.map((r) => ({
      date: r.source_date || r.updated_at || r.created_at || "",
      title: (r.label || r.relation_type || "Relação") + " · " + ((state.entities.find((e) => e.id === (r.source_id === entity.id ? r.target_id : r.source_id)) || {}).name || "Registro relacionado"),
      url: r.source_url,
      type: "Relação"
    }));
    if (entity.source_date || entity.created_at) events.push({ date: entity.source_date || entity.created_at, title: "Ficha de " + entity.name, url: entity.source_url, type: "Registro" });
    root.appendChild(el("p", "As datas abaixo são as datas cadastradas nas fontes; não indicam, por si só, a data de ocorrência.", "entity-meta"));
    events.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    if (!events.length) root.appendChild(el("p", "Ainda não há eventos datados.", "empty-state"));
    for (const event of events) {
      const row = el("div", undefined, "timeline-row");
      row.appendChild(el("strong", dateLabel(event.date) + " · " + event.type));
      row.appendChild(el("p", event.title));
      addLink(row, event.url, "Abrir documento");
      root.appendChild(row);
    }
    const claims = state.claims.filter((claim) => String(claim.speaker || "").toLocaleLowerCase("pt-BR") === entity.name.toLocaleLowerCase("pt-BR"));
    root.appendChild(el("h4", "Afirmações públicas da pessoa"));
    if (!claims.length) root.appendChild(el("p", "Não há afirmações publicadas com este nome exato. Use a busca de transcrições para procurar outros registros.", "empty-state"));
    for (const claim of claims.slice(0, 8)) {
      const row = el("div", undefined, "timeline-row");
      row.appendChild(el("strong", dateLabel(claim.claim_date) + " · " + (labels[claim.verdict] || claim.verdict || "Não verificado")));
      row.appendChild(el("p", claim.quote || "Afirmação sem transcrição"));
      addLink(row, claimUrl(claim), "Abrir fonte no trecho");
      const detail = el("button", "Ver fontes que sustentam ou contradizem", "button button-outline");
      detail.type = "button";
      detail.addEventListener("click", () => loadSourceSides(claim.id, row));
      row.appendChild(detail);
      root.appendChild(row);
    }
  }
  async function loadSourceSides(claimId, parent) {
    const old = parent.querySelector(".source-columns");
    if (old) { old.remove(); return; }
    const data = await getJson("/api/claims/" + encodeURIComponent(claimId));
    const columns = el("div", undefined, "source-columns");
    for (const side of ["supports", "contradicts"]) {
      const col = el("section", undefined, "source-column");
      col.appendChild(el("h4", side === "supports" ? "Fontes que sustentam" : "Fontes que contradizem/limitam"));
      const items = (data.sources || []).filter((source) => source.side === side);
      if (!items.length) col.appendChild(el("p", "Nenhuma fonte cadastrada nesta categoria.", "entity-meta"));
      for (const source of items) {
        const p = el("p", (source.title || source.publisher || "Fonte") + " · " + dateLabel(source.published_date));
        if (source.excerpt) p.appendChild(document.createTextNode(" — " + source.excerpt));
        addLink(p, source.url, "Abrir fonte original");
        col.appendChild(p);
      }
      columns.appendChild(col);
    }
    parent.appendChild(columns);
  }
  function renderClaims() {
    const root = $("claim-results");
    root.replaceChildren();
    const q = $("claim-search").value.trim().toLocaleLowerCase("pt-BR");
    const claims = state.claims.filter((claim) => !q || [claim.speaker, claim.quote, claim.context, claim.topic, claim.location].join(" ").toLocaleLowerCase("pt-BR").includes(q));
    $("claim-search-status").textContent = claims.length + " afirmação(ões) correspondente(s).";
    if (!claims.length) {
      root.appendChild(el("p", "Nenhuma transcrição corresponde à busca.", "empty-state"));
      return;
    }
    for (const claim of claims.slice(0, 30)) {
      const card = el("article", undefined, "claim-result");
      card.appendChild(el("p", (claim.topic || "Tema não informado") + " · " + (labels[claim.verdict] || claim.verdict || "Não verificado"), "entity-meta"));
      card.appendChild(el("h3", claim.speaker || "Pessoa não informada"));
      card.appendChild(el("p", claim.quote || "Transcrição não cadastrada"));
      if (claim.context) card.appendChild(el("p", claim.context));
      card.appendChild(el("p", dateLabel(claim.claim_date) + " · " + (claim.claim_type || "Tipo não informado"), "entity-meta"));
      const actions = el("div", undefined, "source-actions");
      const href = claimUrl(claim);
      const source = el("a", "Abrir fonte", "button button-outline");
      source.href = href || "/debates.html#claim-" + encodeURIComponent(claim.id);
      source.target = href ? "_blank" : "_self";
      source.rel = "noopener noreferrer";
      actions.appendChild(source);
      const copy = el("button", "Copiar link", "button button-outline");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        const url = new URL("/debates.html#claim-" + encodeURIComponent(claim.id), location.origin).href;
        try { await navigator.clipboard.writeText(url); copy.textContent = "Link copiado"; }
        catch { copy.textContent = "Copie o link da barra"; }
      });
      actions.appendChild(copy);
      const share = el("a", "WhatsApp", "button button-outline");
      share.href = "https://wa.me/?text=" + encodeURIComponent((claim.speaker || "Afirmação") + ": " + (claim.quote || "") + " " + new URL("/debates.html#claim-" + encodeURIComponent(claim.id), location.origin).href);
      share.target = "_blank";
      share.rel = "noopener noreferrer";
      actions.appendChild(share);
      const report = el("a", "Reportar erro", "button button-outline");
      report.href = "/debates.html#claim-" + encodeURIComponent(claim.id);
      actions.appendChild(report);
      card.appendChild(actions);
      root.appendChild(card);
    }
  }
  async function refresh() {
    $("network-status").textContent = "Atualizando dados…";
    try {
      const results = await Promise.all([getJson("/api/entities"), getJson("/api/relationships"), getJson("/api/claims")]);
      state.entities = results[0].entities || [];
      state.relationships = results[1].relationships || [];
      state.claims = results[2].claims || [];
      fillTypeFilter();
      renderEntities();
      renderClaims();
      if (state.selected) {
        const selected = state.entities.find((entity) => entity.id === state.selected);
        if (selected) await renderDetail(selected);
        else $("entity-detail").replaceChildren(el("p", "Selecione uma ficha para ver suas conexões.", "empty-state"));
      }
    } catch (error) {
      $("network-status").textContent = error.message;
      $("entity-list").replaceChildren(el("p", "Não foi possível carregar as fichas agora.", "empty-state"));
      $("claim-results").replaceChildren(el("p", "Não foi possível carregar as afirmações agora.", "empty-state"));
    }
  }
  function init() {
    $("entity-search").addEventListener("input", renderEntities);
    $("entity-type").addEventListener("change", renderEntities);
    $("entity-status").addEventListener("change", renderEntities);
    $("claim-search").addEventListener("input", renderClaims);
    $("refresh-network").addEventListener("click", refresh);
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();