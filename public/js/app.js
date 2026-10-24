
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
    loadingDocuments: false,
    loadingSourceQueue: false,
    loadingPublicBoard: false,
    sourceQueue: [],
    publicSources: [],
    publicSourceStats: null,
    publicSourceMode: "all",
    uploadingDocument: false
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const elements = {
    adminOpen: $("#admin-open"),
    adminDialog: $("#admin-dialog"),
    loginForm: $("#login-form"),
    adminPassword: $("#admin-password"),
    loginStatus: $("#login-status"),
    adminLoginPanel: $("#admin-login-panel"),
    auditPanel: $("#audit-panel"),
    auditList: $("#audit-list"),
    logoutButton: $("#logout-button"),
    sourceQueuePanel: $("#source-queue-panel"),
    sourceIntakePanel: $("#source-intake-panel"),
    sourceIntakeForm: $("#source-intake-form"),
    sourceIntakeUrls: $("#source-intake-urls"),
    sourceIntakeText: $("#source-intake-text"),
    sourceIntakeMedia: $("#source-intake-media"),
    sourceIntakeTitle: $("#source-intake-title"),
    sourceIntakeStatus: $("#source-intake-status"),
    sourceQueueStatus: $("#source-queue-status"),
    sourceQueueSearch: $("#source-queue-search"),
    sourceQueueList: $("#source-queue-list"),
    refreshSourceQueue: $("#refresh-source-queue"),
    processSourceQueue: $("#process-source-queue"),
    retrySourceErrors: $("#retry-source-errors"),
    geminiReviewPanel: $("#gemini-review-panel"),

    search: $("#search"),
    searchButton: $("#search-button"),
    graph: $("#graph"),
    publicSourceList: $("#public-source-list"),
    boardSummary: $("#board-summary"),
    sourceStats: $("#source-stats"),
    sourceCategoryFilter: $("#source-category-filter"),
    sourceLiveState: $("#source-live-state"),
    refreshSources: $("#refresh-sources"),
    graphDetails: $("#entity-details"),
    refreshGraph: $("#refresh-graph"),

    uploadForm: $("#upload-form"),
    pdfFile: $("#pdf-file"),
    uploadAccess: $("#upload-access"),
    uploadStatus: $("#upload-status"),
    documentsPanel: $("#documents-panel"),
    documentsList: $("#documents-list"),
    refreshDocuments: $("#refresh-documents"),

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

  function formatFileSize(bytes) {
    const size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) {
      return "Tamanho desconhecido";
    }

    if (size < 1024) {
      return `${size} bytes`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
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
    if (elements.adminLoginPanel) {
      elements.adminLoginPanel.hidden = state.isAdmin;
    }
    if (elements.geminiReviewPanel) {
      elements.geminiReviewPanel.hidden = !state.isAdmin;
    }

    if (elements.auditPanel) {
      elements.auditPanel.hidden = !state.isAdmin;
    }

    if (elements.sourceQueuePanel) {
      elements.sourceQueuePanel.hidden = !state.isAdmin;
    }
    if (elements.sourceIntakePanel) {
      elements.sourceIntakePanel.hidden = !state.isAdmin;
    }

    if (elements.adminPassword) {
      elements.adminPassword.value = "";
    }

    updateUploadAccess();

    if (state.isAdmin) {
      await Promise.allSettled([
        loadDocuments(),
        loadAuditEvents(),
        loadSourceQueue()
      ]);
    } else {
      if (elements.documentsPanel) {
        elements.documentsPanel.hidden = true;
      }

      if (elements.documentsList) {
        elements.documentsList.replaceChildren();
      }

      if (elements.auditList) {
        elements.auditList.replaceChildren();
      }

      state.sourceQueue = [];
      if (elements.sourceQueueList) elements.sourceQueueList.replaceChildren();
      if (elements.sourceQueueStatus) setText(elements.sourceQueueStatus, "");
    }
  }

  function updateUploadAccess() {
    const fileInput = elements.pdfFile;
    const submitButton = elements.uploadForm?.querySelector(
      'button[type="submit"]'
    );

    if (fileInput) {
      fileInput.disabled = !state.isAdmin || state.uploadingDocument;
    }

    if (submitButton) {
      submitButton.disabled = !state.isAdmin || state.uploadingDocument;
    }

    if (elements.uploadAccess) {
      setText(
        elements.uploadAccess,
        state.isAdmin
          ? "Sessão administrativa ativa. Você pode enviar um PDF de até 10 MB."
          : "Entre na área administrativa para habilitar o envio de documentos."
      );
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

      // /admin é servido de forma diferente pelo backend conforme a sessão.
      // Recarregar faz o servidor enviar o painel privado após autenticar.
      if (window.location.pathname === "/admin") {
        window.location.replace("/admin");
        return;
      }

      await setAdminState(true);

      setStatus(elements.loginStatus, "Login realizado.");
    } catch (error) {
      setStatus(
        elements.loginStatus,
        error.message || "Não foi possível autenticar.",
        true
      );
    } finally {
      setButtonLoading(submitButton, false);
      updateUploadAccess();
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

      if (window.location.pathname === "/admin") {
        // Após sair, o servidor entrega somente a tela de autenticação.
        window.location.replace("/admin");
        return;
      }

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
  // Fontes coletadas no Turso (somente leitura)
  // ------------------------------------------------------------

  function readableQueueStatus(status) {
    const labels = {
      pending: "Pendente",
      processing: "Em processamento",
      completed: "Concluída",
      error: "Precisa de revisão"
    };
    return labels[status] || "Desconhecido";
  }

  function renderSourceQueue() {
    if (!elements.sourceQueueList) return;

    const term = (elements.sourceQueueSearch?.value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    const sources = state.sourceQueue.filter((source) => {
      if (!term) return true;
      return [source.title, source.url, source.summary, source.status, source.error_message]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
    });

    elements.sourceQueueList.replaceChildren();

    if (sources.length === 0) {
      elements.sourceQueueList.appendChild(
        createMessage(
          term ? "Nenhuma fonte corresponde ao filtro." : "Nenhuma fonte disponível na fila do Turso."
        )
      );
      return;
    }

    for (const source of sources) {
      const item = createElement("li", "source-queue-item");
      const header = createElement("div", "source-queue-item-heading");
      const title = createElement("strong", "source-queue-title", source.title || "Fonte sem título");
      const knownStatus = ["pending", "processing", "completed", "error"].includes(source.status)
        ? source.status
        : "unknown";
      const status = createElement(
        "span",
        `source-queue-status source-status-${knownStatus}`,
        readableQueueStatus(source.status)
      );
      header.append(title, status);
      item.appendChild(header);

      if (source.summary) {
        item.appendChild(createElement("p", "source-queue-summary", source.summary));
      }

      if (source.error_message) {
        item.appendChild(createElement("p", "source-queue-error", `Observação: ${source.error_message}`));
      }

      const footer = createElement("div", "source-queue-item-footer");
      const date = createElement("span", "muted", `Atualizada: ${formatDate(source.updated_at || source.created_at)}`);
      footer.appendChild(date);
      appendSourceLink(footer, source.url, "Abrir fonte");
      item.appendChild(footer);
      elements.sourceQueueList.appendChild(item);
    }
  }



  async function handleSourceIntake(event) {
    event.preventDefault();
    if (!state.isAdmin || !elements.sourceIntakeForm) return;
    const payload = {
      urls: elements.sourceIntakeUrls ? elements.sourceIntakeUrls.value : "",
      raw_text: elements.sourceIntakeText ? elements.sourceIntakeText.value : "",
      media_url: elements.sourceIntakeMedia ? elements.sourceIntakeMedia.value : "",
      title: elements.sourceIntakeTitle ? elements.sourceIntakeTitle.value : ""
    };
    const submit = elements.sourceIntakeForm.querySelector('button[type="submit"]');
    setStatus(elements.sourceIntakeStatus, "Enviando material para a fila segura…");
    setButtonLoading(submit, true, "Adicionando…");
    try {
      const result = await apiFetch("/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken },
        body: JSON.stringify(payload)
      });
      setStatus(elements.sourceIntakeStatus, result.message || "Material adicionado à fila.");
      if (elements.sourceIntakeUrls) elements.sourceIntakeUrls.value = "";
      if (elements.sourceIntakeText) elements.sourceIntakeText.value = "";
      if (elements.sourceIntakeMedia) elements.sourceIntakeMedia.value = "";
      if (elements.sourceIntakeTitle) elements.sourceIntakeTitle.value = "";
      await loadSourceQueue();
    } catch (error) {
      setStatus(elements.sourceIntakeStatus, error.message || "Não foi possível adicionar o material.", true);
    } finally {
      setButtonLoading(submit, false);
    }
  }

  async function processSourceQueue({ retryErrors = false } = {}) {
    const triggerButton = retryErrors ? elements.retrySourceErrors : elements.processSourceQueue;
    if (!state.isAdmin || !triggerButton) return;
    setButtonLoading(triggerButton, true, retryErrors ? "Tentando novamente…" : "Processando…");
    setStatus(
      elements.sourceQueueStatus,
      retryErrors
        ? "Tentando novamente até 3 fontes com erro…"
        : "Extraindo páginas e analisando até 3 fontes com Gemini…"
    );
    try {
      const data = await apiFetch("/admin/process-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken },
        body: JSON.stringify({ limit: 3, retryErrors })
      });
      await loadSourceQueue();
      setStatus(elements.sourceQueueStatus, data.message || ("Lote concluído: " + (data.completed || 0) + " fontes processadas, " + (data.errors || 0) + " com erro."), Boolean(data.errors));
    } catch (error) {
      setStatus(elements.sourceQueueStatus, error.message || "Não foi possível processar as fontes.", true);
    } finally {
      setButtonLoading(triggerButton, false);
    }
  }

  async function loadSourceQueue() {
    if (!state.isAdmin || !elements.sourceQueueList || state.loadingSourceQueue) return;

    state.loadingSourceQueue = true;
    setButtonLoading(elements.refreshSourceQueue, true, "Carregando…");
    elements.sourceQueueList.replaceChildren(createMessage("Carregando fontes do Turso…"));
    setStatus(elements.sourceQueueStatus, "");

    try {
      const data = await apiFetch("/admin/sources");
      state.sourceQueue = Array.isArray(data.sources) ? data.sources : [];
      const counts = { completed: 0, pending: 0, processing: 0, error: 0 };
      for (const source of state.sourceQueue) {
        if (Object.prototype.hasOwnProperty.call(counts, source.status)) {
          counts[source.status] += 1;
        }
      }

      setStatus(
        elements.sourceQueueStatus,
        `${state.sourceQueue.length} fontes · ${counts.completed} concluídas · ${counts.pending} pendentes · ${counts.error} para revisão`
      );
      renderSourceQueue();
    } catch (error) {
      state.sourceQueue = [];
      elements.sourceQueueList.replaceChildren(
        createMessage(error.message || "Não foi possível carregar as fontes.", "error-message")
      );
      setStatus(
        elements.sourceQueueStatus,
        error.message || "Não foi possível carregar a fila de fontes.",
        true
      );
    } finally {
      state.loadingSourceQueue = false;
      setButtonLoading(elements.refreshSourceQueue, false);
    }
  }




  function youtubeId(value) {
    try {
      const u = new URL(String(value || "")), host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
      let id = "";
      if (host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0] || "";
      else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const p = u.pathname.split("/").filter(Boolean);
        if (u.pathname === "/watch" || u.pathname === "/live") id = u.searchParams.get("v") || "";
        else if (["embed", "shorts", "live", "v"].includes(p[0])) id = p[1] || "";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    } catch { return ""; }
  }
  function timestampSeconds(value) {
    const t = String(value || "").trim();
    if (/^\d+$/.test(t)) return Number(t);
    const p = t.split(":").map(Number);
    if (p.length === 3 && p.every(Number.isFinite)) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2 && p.every(Number.isFinite)) return p[0] * 60 + p[1];
    return 0;
  }
  function timestampLabel(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60].map((x) => String(x).padStart(2, "0")).join(":");
  }
  function parseSourceSummary(value) {
    const raw = String(value || "").trim(), marker = "FICHA_AUTO_JSON:", pos = raw.indexOf(marker);
    const narrative = pos >= 0 ? raw.slice(0, pos).trim() : raw;
    const lines = narrative.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const read = (label) => lines.find((x) => x.toLocaleLowerCase("pt-BR").startsWith(label.toLocaleLowerCase("pt-BR") + ":"))?.slice(label.length + 1).trim() || "";
    let ficha = null;
    if (pos >= 0) { try { ficha = JSON.parse(raw.slice(pos + marker.length).trim()); } catch {} }
    return {
      category: read("Categoria") || "Outros", eventDate: read("Data mencionada"),
      people: read("Pessoas citadas"), organizations: read("Instituições citadas"),
      cases: read("Casos e processos"), legalStatus: read("Andamento mencionado pela fonte"),
      summary: read("Resumo da fonte") || narrative,
      points: lines.filter((x) => x.toLocaleLowerCase("pt-BR").startsWith("ponto relevante:")).map((x) => x.slice(x.indexOf(":") + 1).trim()).filter(Boolean),
      limitations: read("Limites do material"), ficha
    };
  }
  function renderPublicSources() {
    if (!elements.publicSourceList) return;
    const term = (elements.search?.value || "").trim().toLocaleLowerCase("pt-BR"), filter = elements.sourceCategoryFilter?.value || "";
    const mode = state.publicSourceMode || "all", all = Array.isArray(state.publicSources) ? state.publicSources : [];
    const visible = all.filter((s) => {
      const d = parseSourceSummary(s.summary || s.description || ""), category = s.category || d.category || "Outros";
      const ficha = d.ficha || {}, claim = ficha.claim || null;
      const isVideo = Boolean(ficha.video_id || youtubeId(s.media_url || ficha.media_url || s.url));
      const isImage = Boolean(ficha.image_url || (s.media_type === "image" && s.media_url));
      const isLegal = /process|justiça|sentença|tribunal|lei|medida|governo|decisão/i.test([category, s.title, d.cases, d.legalStatus].join(" "));
      const modeOK = mode === "all" || (mode === "claims" && claim && claim.quote) || (mode === "media" && (isVideo || isImage)) || (mode === "legal" && isLegal);
      const searchable = [s.title,s.url,s.summary,s.description,category,d.people,d.organizations,d.cases,d.legalStatus,claim && claim.quote,claim && claim.speaker].join(" ").toLocaleLowerCase("pt-BR");
      return Boolean(modeOK) && (!term || searchable.includes(term)) && (!filter || category === filter);
    });
    if (elements.sourceStats) {
      elements.sourceStats.replaceChildren();
      const st = state.publicSourceStats || {};
      for (const m of [
        {label:"Fontes processadas",value:Number(st.completed ?? all.filter((x)=>x.status==="completed").length),caption:"resumos disponíveis",symbol:"↗"},
        {label:"Na fila automática",value:Number(st.pending || 0),caption:"aguardando processamento",symbol:"◷"},
        {label:"Ligações no mural",value:Number(st.connections || 0),caption:"relações documentadas",symbol:"⌘"}
      ]) {
        const tile = createElement("article","source-stat");
        tile.append(createElement("span","source-stat-symbol",m.symbol),createElement("span","source-stat-label",m.label),createElement("strong","source-stat-value",m.value.toLocaleString("pt-BR")),createElement("small","",m.caption));
        elements.sourceStats.appendChild(tile);
      }
    }
    const last = state.publicSourceStats?.lastUpdated;
    if (elements.boardSummary) elements.boardSummary.textContent = state.publicSourceStats?.queueAvailable === false
      ? "A fila automática está temporariamente indisponível; tente sincronizar novamente."
      : visible.length + " item(ns) exibido(s)" + ((term || filter || mode !== "all") ? " com os filtros atuais" : "") + " · última atualização: " + (last ? formatDate(last) : "ainda não registrada") + ".";
    if (elements.sourceLiveState) {
      elements.sourceLiveState.textContent = state.publicSourceStats?.queueAvailable === false ? "Radar indisponível" : "Radar ativo · atualização automática";
      elements.sourceLiveState.classList.toggle("live-indicator-error", state.publicSourceStats?.queueAvailable === false);
    }
    elements.publicSourceList.replaceChildren();
    if (!visible.length) {
      const message = state.publicSourceStats?.queueAvailable === false ? "Não foi possível consultar as fontes. Tente sincronizar novamente."
        : all.length ? "Nenhum registro corresponde a esta busca ou filtro. Selecione “Tudo” para ver os outros materiais."
        : "Ainda não há fontes processadas. O radar consulta feeds públicos diariamente e adiciona páginas legíveis à fila.";
      elements.publicSourceList.appendChild(createMessage(message));
      return;
    }
    for (const s of visible) {
      const d = parseSourceSummary(s.summary || s.description || ""), ficha = d.ficha || {};
      const claim = ficha.claim || null, fact = claim && claim.fact_check || null, sourceUrl = s.url || s.original_url || "";
      const candidateId = String(ficha.video_id || youtubeId(s.media_url || ficha.media_url || sourceUrl) || "");
      const videoId = /^[A-Za-z0-9_-]{11}$/.test(candidateId) ? candidateId : "";
      const imageUrl = String(ficha.image_url || (s.media_type === "image" ? s.media_url : ""));
      const card = createElement("article","public-source-card" + (videoId ? " has-video" : ""));
      const top = createElement("div","source-card-top");
      top.append(createElement("span","source-card-category",s.category || d.category || "Outros"),createElement("span","source-card-status",s.status === "completed" ? "Processada" : "Referência"));
      card.append(top,createElement("h3","source-card-title",s.title || "Fonte sem título"));
      if (videoId) {
        const start = Math.max(0,Number(ficha.video_start || 0) || timestampSeconds(claim && claim.timestamp));
        const frame = createElement("iframe","source-video-frame");
        frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + (start ? "?start=" + start : "");
        frame.title = "Vídeo original relacionado ao registro"; frame.loading = "lazy"; frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.setAttribute("allowfullscreen","");
        card.appendChild(frame);
        if (claim && claim.timestamp) card.appendChild(createElement("p","source-video-timestamp","Trecho identificado na transcrição: " + claim.timestamp));
        if (!ficha.transcript_available) card.appendChild(createElement("p","source-media-note","O player está disponível, mas não encontramos transcrição pública utilizável para atribuir uma fala literal automaticamente."));
      } else if (/^https?:\/\//i.test(imageUrl)) {
        const link = createElement("a","source-image-link"); link.href=imageUrl; link.target="_blank"; link.rel="noopener noreferrer";
        const image = createElement("img","source-preview-image"); image.src=imageUrl; image.alt="Imagem associada à fonte: " + (s.title || "material"); image.loading="lazy"; image.decoding="async";
        link.appendChild(image); card.appendChild(link);
      }
      if (claim && claim.quote) {
        const box = createElement("section","source-claim-box");
        box.appendChild(createElement("p","eyebrow",claim.speaker ? "FALA ATRIBUÍDA A " + claim.speaker : "TRECHO CITADO NA FONTE"));
        box.appendChild(createElement("blockquote","source-claim-quote","“" + claim.quote + "”"));
        if (claim.context) box.appendChild(createElement("p","source-claim-context",claim.context));
        if (claim.timestamp) box.appendChild(createElement("p","source-video-timestamp","Timestamp da fala: " + claim.timestamp));
        if (fact) {
          const labels={verdadeira:"Evidências sustentam a afirmação",falsa:"Evidências contradizem a afirmação",enganosa:"Parcialmente correta / enganosa",fora_de_contexto:"Contexto muda a interpretação",inconclusiva:"Inconclusiva",nao_verificada:"Ainda não verificada",opiniao_previsao:"Opinião, proposta ou previsão"};
          box.appendChild(createElement("span","fact-verdict verdict-" + fact.verdict,labels[fact.verdict] || "Checagem automática"));
          box.appendChild(createElement("p","source-fact-explanation",fact.explanation || "A checagem ainda não tem evidências suficientes."));
          if(fact.context_note)box.appendChild(createElement("p","source-claim-context",fact.context_note));
          const details=createElement("details","source-evidence-details");details.appendChild(createElement("summary","","Ver fontes e evidências"));
          const grid=createElement("div","source-evidence-grid");
          const groups=[
            {label:"Fontes que sustentam",items:fact.supporting_sources||[],empty:"Nenhuma fonte de apoio foi vinculada com confiança suficiente."},
            {label:"Fontes que contradizem ou limitam",items:fact.contradictory_sources||[],empty:"A pesquisa não conseguiu vincular uma fonte que contradiga ou limite diretamente esta afirmação. Isso não prova que ela não exista."}
          ];
          const shown=new Set();
          for(const group of groups){
            const section=createElement("section","source-evidence-group");
            section.appendChild(createElement("h4","",group.label));
            if(!group.items.length) section.appendChild(createElement("p","source-evidence-link",group.empty));
            for(const item of group.items.slice(0,2)){
              const row=createElement("p","source-evidence-link");
              appendSourceLink(row,item.url,item.title||"Abrir fonte consultada");
              section.appendChild(row);
              if(item.url)shown.add(item.url);
            }
            grid.appendChild(section);
          }
          const otherSources=(fact.searched_sources||[]).filter((item)=>item.url&&!shown.has(item.url)).slice(0,4);
          if(otherSources.length){
            const section=createElement("section","source-evidence-group");
            section.appendChild(createElement("h4","","Outras fontes encontradas (sem posição atribuída)"));
            for(const item of otherSources){
              const row=createElement("p","source-evidence-link");
              appendSourceLink(row,item.url,item.title||"Abrir fonte consultada");
              section.appendChild(row);
            }
            grid.appendChild(section);
          }
          details.appendChild(grid);if(fact.verified_at)details.appendChild(createElement("p","muted","Pesquisa: "+formatDate(fact.verified_at)+". Resultado automatizado; novas evidências podem mudar a conclusão."));
          box.appendChild(details);
        } else box.appendChild(createElement("span","fact-verdict verdict-nao_verificada",claim.verifiable?"Ainda não verificada":"Não é uma afirmação factual verificável"));
        card.appendChild(box);
      }
      if(d.eventDate||d.legalStatus){const context=createElement("div","source-context-grid");if(d.eventDate){const item=createElement("div","source-context-item");item.append(createElement("span","source-context-label","Data mencionada"),createElement("strong","",d.eventDate));context.appendChild(item)}if(d.legalStatus){const item=createElement("div","source-context-item");item.append(createElement("span","source-context-label","Andamento informado"),createElement("strong","",d.legalStatus));context.appendChild(item)}card.appendChild(context)}
      if(d.summary)card.appendChild(createElement("p","source-card-summary",d.summary));
      const extra=createElement("details","source-points-details");extra.appendChild(createElement("summary","","Pontos relevantes e contexto"));const inner=createElement("div","source-points-content");
      const meta=[{label:"Pessoas citadas",value:d.people},{label:"Instituições",value:d.organizations},{label:"Casos e processos",value:d.cases}].filter((x)=>x.value);
      if(meta.length){const dl=createElement("dl","source-metadata");for(const item of meta){const row=createElement("div","source-metadata-row");row.append(createElement("dt","",item.label),createElement("dd","",item.value));dl.appendChild(row)}inner.appendChild(dl)}
      if(d.points.length){const list=createElement("ul","source-key-points");for(const point of d.points)list.appendChild(createElement("li","",point));inner.appendChild(list)}
      if(d.limitations)inner.appendChild(createElement("p","source-limitation","Limites do material: "+d.limitations));
      if(!inner.childNodes.length)inner.appendChild(createMessage("A fonte não trouxe detalhes adicionais estruturados."));
      extra.appendChild(inner);card.appendChild(extra);
      const footer=createElement("div","source-card-footer"),date=s.updated_at||s.created_at;
      footer.appendChild(createElement("span","source-card-date",date?"Processada: "+formatDate(date):"Data de processamento não informada"));
      if(sourceUrl)appendSourceLink(footer,sourceUrl,"Fonte original ↗");else footer.appendChild(createElement("span","source-card-date","Texto enviado sem URL original"));
      if(ficha.video_source_url)appendSourceLink(footer,ficha.video_source_url,"Abrir vídeo ↗");
      card.appendChild(footer);elements.publicSourceList.appendChild(card);
    }
  }

  async function loadPublicBoard() {
    if(!elements.publicSourceList||state.loadingPublicBoard)return;state.loadingPublicBoard=true;if(elements.sourceLiveState)elements.sourceLiveState.textContent="Sincronizando fontes…";
    if(!state.publicSources.length)elements.publicSourceList.replaceChildren(createMessage("Consultando o banco e os feeds públicos…"));
    try{const r=await fetch(API+"/sources",{headers:{Accept:"application/json"},cache:"no-store"}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Falha ao carregar fontes (HTTP "+r.status+").");state.publicSources=Array.isArray(data.sources)?data.sources:[];state.publicSourceStats={...(data.stats||{}),queueAvailable:data.queueAvailable!==false};renderPublicSources()}
    catch(e){state.publicSourceStats={...(state.publicSourceStats||{}),queueAvailable:false};elements.publicSourceList.replaceChildren(createMessage(e.message||"Não foi possível carregar fontes.","error-message"));if(elements.boardSummary)elements.boardSummary.textContent="Não foi possível conectar ao banco de fontes.";if(elements.sourceLiveState){elements.sourceLiveState.textContent="Radar indisponível";elements.sourceLiveState.classList.add("live-indicator-error")}}
    finally{state.loadingPublicBoard=false}
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
            : "O mapa está sendo montado a partir das fontes processadas. Consulte também o radar de fontes abaixo."
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
  // Upload e gestão de documentos privados
  // ------------------------------------------------------------

  async function handleDocumentUpload(event) {
    event.preventDefault();

    if (!state.isAdmin) {
      setStatus(
        elements.uploadStatus,
        "Entre na área administrativa antes de enviar documentos.",
        true
      );
      return;
    }

    if (state.uploadingDocument) return;

    const file = elements.pdfFile?.files?.[0];

    if (!file) {
      setStatus(elements.uploadStatus, "Selecione um PDF.", true);
      return;
    }

    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.type !== "application/pdf"
    ) {
      setStatus(
        elements.uploadStatus,
        "Selecione um arquivo com extensão PDF e tipo application/pdf.",
        true
      );
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setStatus(
        elements.uploadStatus,
        "O arquivo ultrapassa o limite de 10 MB.",
        true
      );
      return;
    }

    state.uploadingDocument = true;
    updateUploadAccess();

    const submitButton = elements.uploadForm?.querySelector(
      'button[type="submit"]'
    );

    setButtonLoading(submitButton, true, "Enviando…");
    setStatus(elements.uploadStatus, "Enviando e validando o documento…");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await apiFetch("/documents", {
        method: "POST",
        body: formData
      });

      elements.uploadForm.reset();

      setStatus(
        elements.uploadStatus,
        result.message || "PDF enviado com sucesso."
      );

      await loadDocuments();
    } catch (error) {
      setStatus(
        elements.uploadStatus,
        error.message || "Não foi possível enviar o documento.",
        true
      );
    } finally {
      state.uploadingDocument = false;
      setButtonLoading(submitButton, false);
      updateUploadAccess();
    }
  }

  async function loadDocuments() {
    if (!state.isAdmin || !elements.documentsPanel || state.loadingDocuments) return;

    state.loadingDocuments = true;

    if (elements.refreshDocuments) {
      setButtonLoading(elements.refreshDocuments, true, "Atualizando…");
    }

    try {
      const data = await apiFetch("/documents");
      const documents = Array.isArray(data.documents)
        ? data.documents
        : [];

      elements.documentsList?.replaceChildren();

      if (elements.documentsPanel) {
        elements.documentsPanel.hidden = false;
      }

      if (documents.length === 0) {
        elements.documentsList?.appendChild(
          createMessage("Nenhum PDF armazenado.")
        );
        return;
      }

      for (const documentInfo of documents) {
        const item = createElement("li", "document-item");

        const title = createElement(
          "strong",
          "document-name",
          documentInfo.original_name || "documento.pdf"
        );

        const metadata = createElement(
          "p",
          "muted",
          `${formatFileSize(documentInfo.size_bytes)} · Enviado em ${formatDate(documentInfo.uploaded_at)}`
        );

        const download = createElement(
          "a",
          "button button-outline",
          "Baixar PDF"
        );

        download.href =
          `${API}/documents/${encodeURIComponent(documentInfo.id)}/download`;

        download.setAttribute("aria-label", `Baixar ${documentInfo.original_name || "documento PDF"}`);

        const actions = createElement("div", "document-actions");
        actions.appendChild(download);

        const deleteButton = createElement(
          "button",
          "button button-outline",
          "Excluir"
        );

        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => {
          deleteDocument(documentInfo);
        });

        actions.appendChild(deleteButton);
        item.append(title, metadata, actions);
        elements.documentsList?.appendChild(item);
      }
    } catch (error) {
      elements.documentsList?.replaceChildren(
        createMessage(
          error.message || "Não foi possível carregar os documentos.",
          "error-message"
        )
      );

      if (elements.documentsPanel) {
        elements.documentsPanel.hidden = false;
      }
    } finally {
      state.loadingDocuments = false;

      if (elements.refreshDocuments) {
        setButtonLoading(elements.refreshDocuments, false);
      }
    }
  }

  async function deleteDocument(documentInfo) {
    if (!state.isAdmin) {
      setStatus(
        elements.uploadStatus,
        "Sua sessão administrativa não está ativa.",
        true
      );
      return;
    }

    const name = documentInfo.original_name || "este documento";

    if (!window.confirm(`Deseja excluir permanentemente "${name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/documents/${encodeURIComponent(documentInfo.id)}`, {
        method: "DELETE"
      });

      setStatus(elements.uploadStatus, "Documento excluído.");
      await loadDocuments();
    } catch (error) {
      setStatus(
        elements.uploadStatus,
        error.message || "Não foi possível excluir o documento.",
        true
      );
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


  async function handleGeminiReview(event) {
    event.preventDefault();
    const form = $("#gemini-review-form");
    const result = $("#gemini-review-result");
    const button = $("#gemini-review-submit");
    if (!form || !result || !button) return;
    const val = (id) => $(id)?.value.trim() || "";
    const payload = {
      claim: val("#gemini-claim"),
      context: val("#gemini-context"),
      source_title: val("#gemini-source-title"),
      source_url: val("#gemini-source-url"),
      source_excerpt: val("#gemini-source-excerpt")
    };
    button.disabled = true;
    result.replaceChildren(createMessage("Comparando a afirmação com o trecho informado…"));
    try {
      const response = await fetch(`${API}/admin/verify-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken, Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new ApiError(data.error || "A revisão falhou.", response.status);
      const review = data.review;
      result.replaceChildren();
      const heading = createElement("h4", "", `Resultado: ${({
        sustentada: "Sustentada pelo trecho",
        parcialmente_sustentada: "Parcialmente sustentada",
        nao_sustentada_pelo_trecho: "Não sustentada pelo trecho",
        contradita_pelo_trecho: "Contradita pelo trecho",
        inconclusiva: "Inconclusiva"
      })[review.verdict] || "Inconclusiva"}`);
      result.append(heading);
      result.append(createElement("p", "", `Confiança estimada pela IA: ${({baixa:"baixa",media:"média",alta:"alta"})[review.confidence] || "baixa"}. Isso não é uma probabilidade estatística.`));
      if (review.explanation) result.append(createElement("p", "", review.explanation));
      const addList = (title, items) => {
        if (!Array.isArray(items) || !items.length) return;
        result.append(createElement("h5", "", title));
        const ul = createElement("ul", "");
        for (const item of items) ul.append(createElement("li", "", item));
        result.append(ul);
      };
      addList("Pontos apoiados pelo trecho", review.supported_points);
      addList("Informações que faltam", review.missing_points);
      addList("Cuidados", review.cautions);
      if (review.suggested_rewrite) {
        result.append(createElement("h5", "", "Redação mais cautelosa sugerida"));
        result.append(createElement("p", "", review.suggested_rewrite));
      }
      if (review.source_limitations) result.append(createElement("p", "", "Limitações da fonte: " + review.source_limitations));
      result.append(createElement("p", "muted", review.disclaimer || "Revise manualmente antes de publicar."));
    } catch (error) {
      result.replaceChildren(createMessage(error.message || "Não foi possível revisar as evidências.", "empty-state"));
    } finally {
      button.disabled = false;
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
    $("#gemini-review-form")?.addEventListener("submit", handleGeminiReview);
    elements.sourceIntakeForm?.addEventListener("submit", handleSourceIntake);
    document.querySelectorAll("[data-source-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.publicSourceMode = button.getAttribute("data-source-mode") || "all";
        document.querySelectorAll("[data-source-mode]").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderPublicSources();
      });
    });
    elements.logoutButton?.addEventListener("click", handleLogout);
    elements.uploadForm?.addEventListener("submit", handleDocumentUpload);

    elements.refreshGraph?.addEventListener("click", () => { loadGraph(); loadPublicBoard(); });
    elements.refreshSources?.addEventListener("click", loadPublicBoard);
    elements.sourceCategoryFilter?.addEventListener("change", renderPublicSources);
    elements.refreshDocuments?.addEventListener("click", loadDocuments);
    elements.refreshSourceQueue?.addEventListener("click", loadSourceQueue);
    elements.processSourceQueue?.addEventListener("click", () => processSourceQueue());
    elements.retrySourceErrors?.addEventListener("click", () => processSourceQueue({ retryErrors: true }));
    elements.sourceQueueSearch?.addEventListener("input", renderSourceQueue);

    elements.searchButton?.addEventListener("click", () => { applySearch(); renderPublicSources(); });

    elements.search?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySearch();
      }
    });

    elements.search?.addEventListener("input", () => { applySearch(); renderPublicSources(); });

    elements.adminDialog?.addEventListener("close", () => {
      if (elements.adminPassword) {
        elements.adminPassword.value = "";
      }
    });
  }

  async function initialize() {
    attachEvents();
    updateUploadAccess();

    await refreshCsrfToken().catch(() => {
      setStatus(
        elements.loginStatus,
        "O servidor não forneceu um token de segurança. Confira se a API está funcionando.",
        true
      );
    });

    if (window.location.pathname === "/admin") {
      // A página privada não carrega o mural público; só verifica a sessão.
      await checkAdminSession();
    } else {
      // A área pública não faz chamadas de autenticação nem carrega controles admin.
      await Promise.allSettled([loadPublicBoard(), loadGraph(), checkHealth()]);
      window.setInterval(() => { if (document.visibilityState !== "hidden") loadPublicBoard(); }, 120000);
    }

    // O token pode ter falhado na primeira tentativa se a API
    // ainda não estivesse pronta. Não presumimos autenticação.
    if (state.isAdmin) updateUploadAccess();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
