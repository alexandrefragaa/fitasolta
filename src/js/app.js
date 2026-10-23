
"use strict";

(() => {
  const API = "/api";

  const state = {
    csrfToken: "",
    isAdmin: false,
    entities: [],
    relationships: [],
    selectedEntityId: null,
    loadingGraph: false,
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const elements = {
    adminOpen: $("#admin-open"),
    adminDialog: $("#admin-dialog"),
    loginForm: $("#login-form"),
    adminPassword: $("#admin-password"),
    loginStatus: $("#login-status"),
    auditPanel: $("#audit-panel"),
    auditList: $("#audit-list"),
    managePanel: $("#manage-panel"),
    entityForm: $("#entity-form"),
    entityFormStatus: $("#entity-form-status"),
    relationshipForm: $("#relationship-form"),
    relationshipFormStatus: $("#relationship-form-status"),
    relationshipSource: $("#relationship-source"),
    relationshipTarget: $("#relationship-target"),
    sourcesList: $("#sources-list"),
    logoutButton: $("#logout-button"),

    search: $("#search"),
    searchButton: $("#search-button"),
    graph: $("#graph"),
    graphDetails: $("#entity-details"),
    refreshGraph: $("#refresh-graph"),

    healthStatus: $("#health-status"),
    cookieNotice: $("#cookie-notice"),
    cookieDismiss: $("#cookie-dismiss")
  };

  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  function setText(element, message) {
    if (element) {
      element.textContent = String(message ?? "");
    }
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function createMessage(message, className = "empty-state") {
    return createElement("p", className, message);
  }

  function setStatus(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("is-error", isError);
    element.classList.toggle("is-success", !isError && message !== "");
  }

  function setButtonLoading(button, loading, loadingText = "Carregando…") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent.trim();
      }

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function formatDate(value) {
    if (!value) return "Data não informada";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function readableStatus(status) {
    const labels = {
      fato_documentado: "Fato documentado",
      documentado: "Documentado",
      alegacao: "Alegação",
      hipotese: "Hipótese",
      nao_verificado: "Não verificado"
    };

    return labels[status] || status || "Não informado";
  }

  function readableType(type) {
    const labels = {
      person: "Pessoa",
      pessoa: "Pessoa",
      organization: "Organização",
      organizacao: "Organização",
      company: "Empresa",
      empresa: "Empresa",
      institution: "Instituição",
      instituicao: "Instituição",
      document: "Documento",
      documento: "Documento",
      event: "Evento",
      evento: "Evento",
      location: "Local",
      local: "Local",
      other: "Outro",
      outro: "Outro"
    };

    return labels[type] || type || "Não especificado";
  }

  function addLabeledValue(parent, label, value) {
    const paragraph = createElement("p");
    const strong = createElement("strong", "", `${label}: `);

    paragraph.append(
      strong,
      document.createTextNode(
        value === null || value === undefined || value === ""
          ? "Não informado"
          : String(value)
      )
    );

    parent.appendChild(paragraph);
  }

  function safeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      const url = new URL(value);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function appendSourceLink(parent, urlValue, label = "Consultar fonte") {
    const safeUrl = safeHttpUrl(urlValue);

    if (!safeUrl) return;

    const link = createElement("a", "", label);
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    parent.appendChild(link);
  }

  async function refreshCsrfToken() {
    const response = await fetch(`${API}/csrf`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));

    if (
      !response.ok ||
      typeof data.csrfToken !== "string" ||
      data.csrfToken.length === 0
    ) {
      throw new ApiError(
        data.error || "Não foi possível obter o token de segurança.",
        response.status
      );
    }

    state.csrfToken = data.csrfToken;
    return state.csrfToken;
  }

  async function apiFetch(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");

    const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);

    if (unsafeMethod) {
      if (!state.csrfToken) {
        await refreshCsrfToken();
      }

      headers.set("X-CSRF-Token", state.csrfToken);
    }

    let body = options.body;

    if (
      body &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob)
    ) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      method,
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && state.isAdmin) {
        await setAdminState(false);
        setStatus(
          elements.loginStatus,
          "Sua sessão terminou. Entre novamente para continuar.",
          true
        );
      }

      throw new ApiError(
        data.error || `A solicitação falhou (HTTP ${response.status}).`,
        response.status
      );
    }

    return data;
  }

  // ------------------------------------------------------------
  // Autenticação e área administrativa
  // ------------------------------------------------------------

  async function setAdminState(isAdmin) {
    state.isAdmin = isAdmin === true;

    if (elements.loginForm) {
      elements.loginForm.hidden = state.isAdmin;
    }

    if (elements.auditPanel) {
      elements.auditPanel.hidden = !state.isAdmin;
    }
    if (elements.managePanel) {
      elements.managePanel.hidden = !state.isAdmin;
    }

    if (elements.adminPassword) {
      elements.adminPassword.value = "";
    }

    if (state.isAdmin) {
      await loadAuditEvents();
    } else if (elements.auditList) {
      elements.auditList.replaceChildren();
    }
  }

  async function checkAdminSession() {
    try {
      const data = await apiFetch("/auth/me");

      await setAdminState(data.isAdmin === true);
    } catch {
      await setAdminState(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!elements.loginForm || !elements.adminPassword) return;

    const password = elements.adminPassword.value;

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 200
    ) {
      setStatus(
        elements.loginStatus,
        "A senha deve ter entre 12 e 200 caracteres.",
        true
      );
      return;
    }

    const submitButton = elements.loginForm.querySelector(
      'button[type="submit"]'
    );

    setButtonLoading(submitButton, true, "Verificando…");
    setStatus(elements.loginStatus, "");

    try {
      if (!state.csrfToken) {
        await refreshCsrfToken();
      }

      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { password }
      });

      if (data.ok !== true || typeof data.csrfToken !== "string") {
        throw new ApiError("O servidor não confirmou o login.");
      }

      // O servidor regenera a sessão e fornece um novo token CSRF.
      state.csrfToken = data.csrfToken;

      await setAdminState(true);

      setStatus(
        elements.loginStatus,
        "Login realizado. Área administrativa habilitada."
      );
    } catch (error) {
      setStatus(
        elements.loginStatus,
        error.message || "Não foi possível autenticar.",
        true
      );
    } finally {
      setButtonLoading(submitButton, false);
    }
  }

  async function handleLogout() {
    const button = elements.logoutButton;

    setButtonLoading(button, true, "Saindo…");

    try {
      await apiFetch("/auth/logout", {
        method: "POST"
      });

      state.csrfToken = "";

      await setAdminState(false);

      await refreshCsrfToken();

      setStatus(elements.loginStatus, "Sessão encerrada.");
      elements.adminPassword?.focus();
    } catch (error) {
      setStatus(
        elements.loginStatus,
        error.message || "Não foi possível encerrar a sessão.",
        true
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function loadAuditEvents() {
    if (!state.isAdmin || !elements.auditList) return;

    try {
      const data = await apiFetch("/admin/audit");
      const events = Array.isArray(data.events) ? data.events : [];

      elements.auditList.replaceChildren();

      if (events.length === 0) {
        elements.auditList.appendChild(
          createMessage("Nenhum evento de auditoria registrado.")
        );
        return;
      }

      for (const event of events) {
        const item = createElement("li", "audit-event");
        const action = createElement(
          "strong",
          "",
          event.action || "Evento"
        );

        item.appendChild(action);

        const description = createElement(
          "p",
          "",
          [
            event.target_type,
            event.target_id
          ].filter(Boolean).join(" · ") || "Sem alvo informado"
        );

        const date = createElement(
          "time",
          "muted",
          formatDate(event.created_at)
        );

        item.append(description, date);
        elements.auditList.appendChild(item);
      }
    } catch (error) {
      elements.auditList.replaceChildren(
        createMessage(
          error.message || "Não foi possível carregar a auditoria.",
          "error-message"
        )
      );
    }
  }

  // ------------------------------------------------------------
  // Mural de entidades e relações
  // ------------------------------------------------------------

  async function loadGraph() {
    if (state.loadingGraph || !elements.graph) return;

    state.loadingGraph = true;

    if (elements.refreshGraph) {
      setButtonLoading(elements.refreshGraph, true, "Atualizando…");
    }

    elements.graph.replaceChildren(
      createMessage("Carregando entidades e relações…")
    );

    try {
      const [entityData, relationshipData] = await Promise.all([
        apiFetch("/entities"),
        apiFetch("/relationships")
      ]);

      state.entities = Array.isArray(entityData.entities)
        ? entityData.entities
        : [];

      state.relationships = Array.isArray(relationshipData.relationships)
        ? relationshipData.relationships
        : [];

      renderGraph();
      renderSources();
      updateRelationshipChoices();

      if (state.selectedEntityId) {
        const selected = state.entities.find(
          (entity) => entity.id === state.selectedEntityId
        );

        if (selected) {
          renderEntityDetails(selected);
        } else {
          state.selectedEntityId = null;
          renderEmptyDetails();
        }
      } else {
        renderEmptyDetails();
      }
    } catch (error) {
      elements.graph.replaceChildren(
        createMessage(
          error.message || "Não foi possível carregar o mural.",
          "error-message"
        )
      );
    } finally {
      state.loadingGraph = false;

      if (elements.refreshGraph) {
        setButtonLoading(elements.refreshGraph, false);
      }
    }
  }

  function getSearchTerm() {
    return (elements.search?.value || "").trim().toLocaleLowerCase("pt-BR");
  }

  function matchesSearch(value, term) {
    return String(value || "")
      .toLocaleLowerCase("pt-BR")
      .includes(term);
  }

  function renderGraph() {
    if (!elements.graph) return;

    const term = getSearchTerm();

    const visibleEntities = state.entities.filter((entity) => {
      if (!term) return true;

      return [
        entity.name,
        entity.type,
        entity.description,
        entity.evidence_status
      ].some((value) => matchesSearch(value, term));
    });

    const visibleIds = new Set(
      visibleEntities.map((entity) => entity.id)
    );

    const entitiesById = new Map(
      state.entities.map((entity) => [entity.id, entity])
    );

    elements.graph.replaceChildren();

    if (visibleEntities.length === 0) {
      elements.graph.appendChild(
        createMessage(
          term
            ? "Nenhuma entidade corresponde à pesquisa."
            : "Nenhuma entidade cadastrada. Entre na área administrativa para gerenciar os dados."
        )
      );

      return;
    }

    const nodeHeading = createElement("h3", "", "Entidades");
    const nodesContainer = createElement("div", "graph-nodes");

    for (const entity of visibleEntities) {
      const button = createElement("button", "graph-node");
      button.type = "button";
      button.setAttribute(
        "aria-pressed",
        String(state.selectedEntityId === entity.id)
      );

      const title = createElement(
        "span",
        "graph-node-name",
        entity.name || "Entidade sem nome"
      );

      const category = createElement(
        "span",
        "graph-node-type muted",
        readableType(entity.type)
      );

      const status = createElement(
        "span",
        "graph-node-status",
        readableStatus(entity.evidence_status)
      );

      button.append(title, category, status);

      button.addEventListener("click", () => {
        state.selectedEntityId = entity.id;
        renderGraph();
        renderEntityDetails(entity);
      });

      nodesContainer.appendChild(button);
    }

    elements.graph.append(nodeHeading, nodesContainer);

    const visibleRelationships = state.relationships.filter((relationship) => {
      const source = entitiesById.get(relationship.source_id);
      const target = entitiesById.get(relationship.target_id);

      if (!source || !target) return false;

      if (!term) return true;

      const relationMatches = [
        relationship.label,
        relationship.relation_type,
        relationship.description,
        relationship.evidence_status,
        source.name,
        target.name
      ].some((value) => matchesSearch(value, term));

      return (
        relationMatches ||
        visibleIds.has(relationship.source_id) ||
        visibleIds.has(relationship.target_id)
      );
    });

    const relationHeading = createElement(
      "h3",
      "",
      `Relações (${visibleRelationships.length})`
    );

    const relationsContainer = createElement("div", "graph-relations");

    if (visibleRelationships.length === 0) {
      relationsContainer.appendChild(
        createMessage("Nenhuma relação encontrada.")
      );
    } else {
      for (const relationship of visibleRelationships) {
        const source = entitiesById.get(relationship.source_id);
        const target = entitiesById.get(relationship.target_id);

        const button = createElement("button", "graph-relation");
        button.type = "button";

        button.append(
          createElement("span", "graph-relation-source", source.name),
          createElement(
            "span",
            "graph-relation-label",
            ` — ${relationship.label || relationship.relation_type || "Relação"} — `
          ),
          createElement("span", "graph-relation-target", target.name)
        );

        button.addEventListener("click", () => {
          const entity = source;
          state.selectedEntityId = entity.id;
          renderGraph();
          renderEntityDetails(entity);
        });

        const relationInfo = createElement(
          "p",
          "muted",
          `${readableStatus(relationship.evidence_status)} · ${relationship.source_date || "Data não informada"}`
        );

        const wrapper = createElement("div", "graph-relation-item");
        wrapper.append(button, relationInfo);

        relationsContainer.appendChild(wrapper);
      }
    }

    elements.graph.append(relationHeading, relationsContainer);
  }

  function renderSources() {
    if (!elements.sourcesList) return;
    elements.sourcesList.replaceChildren();
    const sources = [];
    for (const entity of state.entities) {
      if (entity.source_url) sources.push({
        title: entity.name || "Fonte vinculada",
        url: entity.source_url,
        date: entity.source_date,
        status: entity.evidence_status,
        context: entity.description
      });
    }
    for (const relation of state.relationships) {
      if (relation.source_url) sources.push({
        title: relation.label || "Fonte de conexão",
        url: relation.source_url,
        date: relation.source_date,
        status: relation.evidence_status,
        context: relation.description
      });
    }
    if (!sources.length) {
      elements.sourcesList.appendChild(createMessage(
        "Nenhuma fonte cadastrada ainda. Entre na Área administrativa e adicione entidades ou conexões com um link de fonte."
      ));
      return;
    }
    sources.sort((a, b) => String(a.title).localeCompare(String(b.title), "pt-BR"));
    for (const source of sources) {
      const article = createElement("article", "source-item");
      const title = createElement("h3", "", source.title);
      const link = createElement("a", "", source.url);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      article.append(title, link);
      if (source.context) article.appendChild(createElement("p", "muted", source.context));
      const metadata = [source.date ? formatDate(source.date) : "", readableStatus(source.status)].filter(Boolean).join(" · ");
      if (metadata) article.appendChild(createElement("p", "muted", metadata));
      elements.sourcesList.appendChild(article);
    }
  }

  function updateRelationshipChoices() {
    for (const select of [elements.relationshipSource, elements.relationshipTarget]) {
      if (!select) continue;
      const previous = select.value;
      select.replaceChildren();
      select.appendChild(new Option("Selecione uma entidade…", ""));
      for (const entity of state.entities) {
        select.appendChild(new Option(`${entity.name} (${readableType(entity.type)})`, entity.id));
      }
      if (state.entities.some((entity) => entity.id === previous)) select.value = previous;
    }
  }

  async function handleEntitySubmit(event) {
    event.preventDefault();
    if (!state.isAdmin || !elements.entityForm) return;
    const button = elements.entityForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Salvando…");
    setStatus(elements.entityFormStatus, "");
    const form = new FormData(elements.entityForm);
    const payload = Object.fromEntries(form.entries());
    try {
      await apiFetch("/entities", { method: "POST", body: payload });
      elements.entityForm.reset();
      await loadGraph();
      setStatus(elements.entityFormStatus, "Registro adicionado ao mural e às fontes, quando houver link.");
    } catch (error) {
      setStatus(elements.entityFormStatus, error.message || "Não foi possível salvar o registro.", true);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function handleRelationshipSubmit(event) {
    event.preventDefault();
    if (!state.isAdmin || !elements.relationshipForm) return;
    const button = elements.relationshipForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Salvando…");
    setStatus(elements.relationshipFormStatus, "");
    const payload = Object.fromEntries(new FormData(elements.relationshipForm).entries());
    try {
      await apiFetch("/relationships", { method: "POST", body: payload });
      elements.relationshipForm.reset();
      await loadGraph();
      setStatus(elements.relationshipFormStatus, "Conexão adicionada ao mural e à lista de fontes, quando houver link.");
    } catch (error) {
      setStatus(elements.relationshipFormStatus, error.message || "Não foi possível salvar a conexão.", true);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderEmptyDetails() {
    if (!elements.graphDetails) return;

    elements.graphDetails.replaceChildren(
      createMessage(
        "Selecione uma entidade para ver os detalhes e as fontes disponíveis.",
        "muted"
      )
    );
  }

  function renderEntityDetails(entity) {
    if (!elements.graphDetails || !entity) return;

    elements.graphDetails.replaceChildren();

    const heading = createElement(
      "h3",
      "",
      entity.name || "Entidade sem nome"
    );

    elements.graphDetails.appendChild(heading);

    addLabeledValue(
      elements.graphDetails,
      "Categoria",
      readableType(entity.type)
    );

    addLabeledValue(
      elements.graphDetails,
      "Classificação",
      readableStatus(entity.evidence_status)
    );

    addLabeledValue(
      elements.graphDetails,
      "Descrição",
      entity.description
    );

    addLabeledValue(
      elements.graphDetails,
      "Data da fonte",
      entity.source_date
    );

    if (entity.source_url) {
      const sourceContainer = createElement("p");
      sourceContainer.appendChild(
        createElement("strong", "", "Fonte: ")
      );

      appendSourceLink(
        sourceContainer,
        entity.source_url,
        "Abrir fonte"
      );

      if (sourceContainer.querySelector("a")) {
        elements.graphDetails.appendChild(sourceContainer);
      } else {
        sourceContainer.appendChild(
          document.createTextNode("URL inválida ou indisponível.")
        );

        elements.graphDetails.appendChild(sourceContainer);
      }
    }

    const related = state.relationships.filter(
      (relationship) =>
        relationship.source_id === entity.id ||
        relationship.target_id === entity.id
    );

    elements.graphDetails.appendChild(
      createElement("h4", "", `Relações associadas (${related.length})`)
    );

    if (related.length === 0) {
      elements.graphDetails.appendChild(
        createMessage("Esta entidade ainda não tem relações cadastradas.")
      );
      return;
    }

    const list = createElement("ul", "entity-relations");

    for (const relationship of related) {
      const source = state.entities.find(
        (item) => item.id === relationship.source_id
      );

      const target = state.entities.find(
        (item) => item.id === relationship.target_id
      );

      const item = createElement("li");

      const relationDescription = [
        source?.name || "Entidade desconhecida",
        relationship.label || relationship.relation_type || "Relação",
        target?.name || "Entidade desconhecida"
      ].join(" — ");

      item.appendChild(
        createElement("strong", "", relationDescription)
      );

      item.appendChild(
        createElement(
          "p",
          "",
          relationship.description || "Sem descrição adicional."
        )
      );

      item.appendChild(
        createElement(
          "p",
          "muted",
          `Classificação: ${readableStatus(relationship.evidence_status)}`
        )
      );

      if (relationship.source_url) {
        appendSourceLink(item, relationship.source_url);
      }

      list.appendChild(item);
    }

    elements.graphDetails.appendChild(list);
  }

  function applySearch() {
    renderGraph();

    const term = getSearchTerm();

    if (!term) return;

    const selected = state.entities.find(
      (entity) => entity.id === state.selectedEntityId
    );

    if (selected) {
      renderEntityDetails(selected);
    }
  }

  // ------------------------------------------------------------
  // Estado de saúde da API
  // ------------------------------------------------------------

  async function checkHealth() {
    if (!elements.healthStatus) return;

    try {
      const data = await apiFetch("/health");

      if (data.ok && data.database === "connected") {
        setText(elements.healthStatus, "Servidor conectado");
        elements.healthStatus.classList.remove("is-error");
        elements.healthStatus.classList.add("is-success");
      } else {
        throw new Error("O servidor informou um estado indisponível.");
      }
    } catch {
      setText(elements.healthStatus, "Servidor indisponível");
      elements.healthStatus.classList.remove("is-success");
      elements.healthStatus.classList.add("is-error");
    }
  }

  // ------------------------------------------------------------
  // Aviso de cookie essencial
  // ------------------------------------------------------------

  function initializeCookieNotice() {
    if (!elements.cookieNotice) return;

    let dismissed = false;

    try {
      dismissed = sessionStorage.getItem("fitasolta-cookie-notice") === "dismissed";
    } catch {
      // Se o armazenamento não estiver disponível, o aviso continua visível.
    }

    elements.cookieNotice.hidden = dismissed;
  }

  function dismissCookieNotice() {
    if (elements.cookieNotice) {
      elements.cookieNotice.hidden = true;
    }

    try {
      sessionStorage.setItem("fitasolta-cookie-notice", "dismissed");
    } catch {
      // O aviso já foi ocultado na página atual.
    }
  }

  // ------------------------------------------------------------
  // Eventos e inicialização
  // ------------------------------------------------------------

  function attachEvents() {
    elements.adminOpen?.addEventListener("click", () => {
      if (!elements.adminDialog) return;

      if (typeof elements.adminDialog.showModal === "function") {
        if (!elements.adminDialog.open) {
          elements.adminDialog.showModal();
        }
      } else {
        elements.adminDialog.setAttribute("open", "");
      }

      if (!state.isAdmin) {
        elements.adminPassword?.focus();
      }
    });

    elements.loginForm?.addEventListener("submit", handleLogin);
    elements.entityForm?.addEventListener("submit", handleEntitySubmit);
    elements.relationshipForm?.addEventListener("submit", handleRelationshipSubmit);
    elements.logoutButton?.addEventListener("click", handleLogout);
    elements.refreshGraph?.addEventListener("click", loadGraph);
    elements.searchButton?.addEventListener("click", applySearch);

    elements.search?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySearch();
      }
    });

    elements.search?.addEventListener("input", applySearch);

    elements.cookieDismiss?.addEventListener(
      "click",
      dismissCookieNotice
    );

    elements.adminDialog?.addEventListener("close", () => {
      if (elements.adminPassword) {
        elements.adminPassword.value = "";
      }
    });
  }

  async function initialize() {
    attachEvents();
    initializeCookieNotice();
    await refreshCsrfToken().catch(() => {
      setStatus(
        elements.loginStatus,
        "O servidor não forneceu um token de segurança. Confira se a API está funcionando.",
        true
      );
    });

    await Promise.allSettled([
      loadGraph(),
      checkHealth(),
      checkAdminSession()
    ]);

    // O token pode ter falhado na primeira tentativa se a API
    // ainda não estivesse pronta. Não presumimos autenticação.
    if (state.isAdmin) {
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
