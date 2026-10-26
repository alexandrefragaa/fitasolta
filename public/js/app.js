
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
    publicSourcePerson: "",
    publicSourceVerdict: "",
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
    sourceIntakeFiles: $("#source-intake-files"),
    sourceIntakeContext: $("#source-intake-context"),
    trashPanel: $("#admin-trash-panel"),
    trashList: $("#trash-list"),
    trashStatus: $("#trash-status"),
    refreshTrash: $("#refresh-trash"),
    sourceIntakeTitle: $("#source-intake-title"),
    sourceIntakeStatus: $("#source-intake-status"),
    sourceQueueStatus: $("#source-queue-status"),
    sourceQueueSearch: $("#source-queue-search"),
    sourceQueueStatusFilter: $("#source-queue-status-filter"),
    sourceQueueCounts: $("#source-queue-counts"),
    sourceQueueList: $("#source-queue-list"),
    refreshSourceQueue: $("#refresh-source-queue"),
    processSourceQueue: $("#process-source-queue"),
    retrySourceErrors: $("#retry-source-errors"),
    rebuildSourceConnections: $("#rebuild-source-connections"),
    geminiReviewPanel: $("#gemini-review-panel"),

    search: $("#search"),
    searchButton: $("#search-button"),
    graph: $("#graph"),
    graphSection: $("#mapa"),
    graphNavLink: $("#nav-relations"),
    publicSourceList: $("#public-source-list"),
    boardSummary: $("#board-summary"),
    sourcePersonFilter: $("#source-person-filter"),
    sourceVerdictFilter: $("#source-verdict-filter"),
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
    if (elements.trashPanel) {
      elements.trashPanel.hidden = !state.isAdmin;
    }

    if (elements.adminPassword) {
      elements.adminPassword.value = "";
    }

    updateUploadAccess();

    if (state.isAdmin) {
      await Promise.allSettled([
        loadDocuments(),
        loadAuditEvents(),
        loadSourceQueue(),
        loadTrash()
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
      if (elements.trashList) elements.trashList.replaceChildren();
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

  function normalizeQueueSourceUrl(value) {
    const safeUrl = safeHttpUrl(String(value || ""));
    if (!safeUrl) return "";
    try {
      const url = new URL(safeUrl);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      let videoId = "";
      if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
        videoId = url.searchParams.get("v") || (url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/) || [])[1] || "";
      }
      if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) return "youtube:" + videoId;
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key);
      }
      return url.href.replace(/\/$/, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function sourceQueueDuplicateKeys(sources) {
    const counts = new Map();
    for (const source of sources) {
      const key = normalizeQueueSourceUrl(source.original_url || source.url || source.media_url);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }

  function renderSourceQueueCounts(duplicateKeys) {
    if (!elements.sourceQueueCounts) return;
    const counts = { pending: 0, processing: 0, completed: 0, error: 0 };
    for (const source of state.sourceQueue) {
      if (Object.prototype.hasOwnProperty.call(counts, source.status)) counts[source.status] += 1;
    }
    const isDuplicate = (source) => {
      const key = normalizeQueueSourceUrl(source.original_url || source.url || source.media_url);
      return Boolean(key && duplicateKeys.has(key));
    };
    const duplicateCount = state.sourceQueue.filter(isDuplicate).length;
    const unlinkedCount = state.sourceQueue.filter((source) => source.linked_to_mural !== true).length;
    const items = [
      ["Pendentes", counts.pending],
      ["Em processamento", counts.processing],
      ["Concluídas", counts.completed],
      ["Com erro", counts.error],
      ["Registros em URLs duplicadas", duplicateCount],
      ["Sem vínculo no mural", unlinkedCount]
    ];
    elements.sourceQueueCounts.replaceChildren(
      ...items.map(([label, count]) => createElement("span", "queue-count", label + ": " + count))
    );
  }

  function renderSourceQueue() {
    if (!elements.sourceQueueList) return;

    const term = (elements.sourceQueueSearch?.value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    const statusFilter = elements.sourceQueueStatusFilter?.value || "all";
    const duplicateKeys = sourceQueueDuplicateKeys(state.sourceQueue);
    renderSourceQueueCounts(duplicateKeys);

    const sources = state.sourceQueue.filter((source) => {
      const key = normalizeQueueSourceUrl(source.original_url || source.url || source.media_url);
      const isDuplicate = Boolean(key && duplicateKeys.has(key));
      const isUnlinked = source.linked_to_mural !== true;
      const matchesFilter =
        statusFilter === "all" ||
        (statusFilter === "duplicates" && isDuplicate) ||
        (statusFilter === "unlinked" && isUnlinked) ||
        (["pending", "processing", "completed", "error"].includes(statusFilter) && source.status === statusFilter);
      const matchesTerm = !term ||
        [source.title, source.url, source.original_url, source.media_url, source.summary, source.status, source.error_message]
          .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
      return matchesFilter && matchesTerm;
    });

    elements.sourceQueueList.replaceChildren();

    if (sources.length === 0) {
      elements.sourceQueueList.appendChild(
        createMessage(
          term || statusFilter !== "all"
            ? "Nenhuma fonte corresponde aos filtros selecionados."
            : "Nenhuma fonte disponível na fila do Turso."
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

      const key = normalizeQueueSourceUrl(source.original_url || source.url || source.media_url);
      if (key && duplicateKeys.has(key)) {
        item.appendChild(createElement("p", "source-queue-flag source-queue-flag-warning", "URL duplicada na fila — revisar antes de processar."));
      }
      if (source.linked_to_mural === true) {
        item.appendChild(createElement("p", "source-queue-flag", "Fonte vinculada a entidade ou relação do mural."));
      } else {
        item.appendChild(createElement("p", "source-queue-flag source-queue-flag-warning", "Sem vínculo com entidade ou relação do mural."));
      }

      if (source.summary) {
        item.appendChild(createElement("p", "source-queue-summary", source.summary));
      }
      if (source.error_message) {
        item.appendChild(createElement("p", "source-queue-error", `Observação: ${source.error_message}`));
      }

      const footer = createElement("div", "source-queue-item-footer");
      footer.appendChild(createElement("span", "muted", `Atualizada: ${formatDate(source.updated_at || source.created_at)}`));
      appendSourceLink(footer, source.url || source.original_url || source.media_url, "Abrir fonte");
      const trashButton = createElement("button", "button button-outline", "Mover para lixeira");
      trashButton.type = "button";
      trashButton.addEventListener("click", async () => {
        if (!window.confirm("Mover esta fonte para a lixeira restaurável?")) return;
        trashButton.disabled = true;
        try { await apiFetch("/admin/sources/" + encodeURIComponent(source.id) + "/trash", { method: "POST", body: {} }); await loadSourceQueue(); await loadTrash(); }
        catch (error) { setStatus(elements.sourceQueueStatus, error.message || "Não foi possível mover para a lixeira.", true); }
        finally { trashButton.disabled = false; }
      });
      footer.appendChild(trashButton);
      item.appendChild(footer);
      elements.sourceQueueList.appendChild(item);
    }
  }



  async function loadTrash() {
    if (!state.isAdmin || !elements.trashList) return;
    elements.trashList.replaceChildren(createMessage("Carregando lixeira…"));
    try {
      const data = await apiFetch("/admin/trash");
      elements.trashList.replaceChildren();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) elements.trashList.appendChild(createMessage("A lixeira está vazia."));
      for (const entry of items) {
        const item = createElement("li", "source-queue-item");
        item.appendChild(createElement("strong", "source-queue-title", "Fonte removida · " + entry.item_id));
        item.appendChild(createElement("p", "muted", "Movida para a lixeira em " + formatDate(entry.created_at)));
        const restore = createElement("button", "button button-outline", "Restaurar");
        restore.type = "button";
        restore.addEventListener("click", async () => {
          restore.disabled = true;
          try { await apiFetch("/admin/trash/" + encodeURIComponent(entry.id) + "/restore", { method: "POST", body: {} }); await loadTrash(); await loadSourceQueue(); }
          catch (error) { setStatus(elements.trashStatus, error.message || "Falha ao restaurar.", true); }
          finally { restore.disabled = false; }
        });
        item.appendChild(restore);
        elements.trashList.appendChild(item);
      }
      setStatus(elements.trashStatus, items.length + " item(ns) na lixeira.");
    } catch (error) { setStatus(elements.trashStatus, error.message || "Não foi possível carregar a lixeira.", true); }
  }

  async function handleSourceIntake(event) {
    event.preventDefault();
    if (!state.isAdmin || !elements.sourceIntakeForm) return;
    const selectedFiles = Array.from(elements.sourceIntakeFiles?.files || []);
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
      let result;
      if (selectedFiles.length) {
        if (selectedFiles.length > 3) throw new Error("Selecione no máximo 3 arquivos por envio.");
        const files = await Promise.all(selectedFiles.map(file => new Promise((resolve, reject) => {
          if (file.size > 1500000) return reject(new Error(file.name + " ultrapassa 1,5 MB."));
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, mime_type: file.type, data: reader.result });
          reader.onerror = () => reject(new Error("Não foi possível ler " + file.name + "."));
          reader.readAsDataURL(file);
        })));
        result = await apiFetch("/admin/upload-analyze", { method: "POST", body: { files, title: payload.title, context: elements.sourceIntakeContext?.value || payload.raw_text } });
        setStatus(elements.sourceIntakeStatus, result.message || "Análise sugerida salva na fila.");
      } else {
        result = await apiFetch("/admin/sources", { method: "POST", body: payload });
        setStatus(elements.sourceIntakeStatus, result.message || "Material adicionado à fila.");
      }
      if (elements.sourceIntakeUrls) elements.sourceIntakeUrls.value = "";
      if (elements.sourceIntakeText) elements.sourceIntakeText.value = "";
      if (elements.sourceIntakeMedia) elements.sourceIntakeMedia.value = "";
      if (elements.sourceIntakeTitle) elements.sourceIntakeTitle.value = "";
      if (elements.sourceIntakeFiles) elements.sourceIntakeFiles.value = "";
      if (elements.sourceIntakeContext) elements.sourceIntakeContext.value = "";
      await loadSourceQueue();
      await loadTrash();
    } catch (error) {
      setStatus(elements.sourceIntakeStatus, error.message || "Não foi possível adicionar o material.", true);
    } finally {
      setButtonLoading(submit, false);
    }
  }

  async function processSourceQueue({ retryErrors = false } = {}) {
    const triggerButton = retryErrors ? elements.retrySourceErrors : elements.processSourceQueue;
    if (!state.isAdmin || !triggerButton) return;
    setButtonLoading(triggerButton, true, retryErrors ? "Tentando novamente…" : "Aguarde…");
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


  async function rebuildSourceConnections() {
    if (!state.isAdmin || !elements.rebuildSourceConnections) return;
    setButtonLoading(elements.rebuildSourceConnections, true, "Reconstruindo…");
    setStatus(elements.sourceQueueStatus, "Recuperando nomes e vínculos das fontes já processadas…");
    try {
      const data = await apiFetch("/admin/rebuild-source-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken },
        body: JSON.stringify({})
      });
      await Promise.all([loadSourceQueue(), loadGraph()]);
      setStatus(elements.sourceQueueStatus, data.message || "Reconstrução concluída.");
    } catch (error) {
      setStatus(elements.sourceQueueStatus, error.message || "Não foi possível reconstruir os vínculos.", true);
    } finally {
      setButtonLoading(elements.rebuildSourceConnections, false);
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
  function videoTimestampUrl(value, seconds) {
    const safe = safeHttpUrl(value);
    if (!safe) return "";
    try {
      const url = new URL(safe);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be" || host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
        url.searchParams.set("t", String(Math.max(0, Math.floor(Number(seconds) || 0))));
      }
      return url.href;
    } catch { return safe; }
  }
  function parseSourceSummary(value) {
    const raw = String(value || "").trim(), marker = "FICHA_AUTO_JSON:", pos = raw.indexOf(marker);
    const narrative = pos >= 0 ? raw.slice(0, pos).trim() : raw;
    const lines = narrative.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const read = (label) => lines.find((x) => x.toLocaleLowerCase("pt-BR").startsWith(label.toLocaleLowerCase("pt-BR") + ":"))?.slice(label.length + 1).trim() || "";
    let ficha = null;
    if (pos >= 0) { try { ficha = JSON.parse(raw.slice(pos + marker.length).trim()); } catch {} }
    return {
      category: read("Categoria") || "", eventDate: read("Data mencionada"),
      people: read("Pessoas citadas"), organizations: read("Instituições citadas"),
      cases: read("Casos e processos"), legalStatus: read("Andamento mencionado pela fonte"),
      summary: read("Resumo da fonte") || narrative,
      points: lines.filter((x) => x.toLocaleLowerCase("pt-BR").startsWith("ponto relevante:")).map((x) => x.slice(x.indexOf(":") + 1).trim()).filter(Boolean),
      limitations: read("Limites do material"), ficha
    };
  }
  function normalizeInvestigativeSearch(value) {
    return String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function mentionCandidateNames(value) {
    const input = Array.isArray(value) ? value : String(value || "").split(/[,;|•\n]+/);
    return input.flatMap((item) => {
      if (item && typeof item === "object") {
        return mentionCandidateNames(item.name || item.label || item.title || "");
      }
      return String(item || "").split(/[,;|•\n]+/)
        .map((name) => name.replace(/^\s*(?:pessoas citadas|instituições citadas|casos e processos)\s*:\s*/i, "").replace(/^[-–•\s]+/, "").replace(/\s+/g, " ").trim())
        .filter((name) => name.length >= 2 && name.length <= 120 && !/^(?:nenhum|nenhuma|não informado|nao informado|n\/a|indefinido|null|undefined|-)$/i.test(name));
    });
  }

  function renderSourcePersonFilter(sources = state.publicSources) {
    const select = elements.sourcePersonFilter;
    if (!select) return;

    const previous = state.publicSourcePerson || select.value || "";
    const mentions = new Map();
    const addNames = (value) => {
      for (const name of mentionCandidateNames(value)) {
        const key = normalizeInvestigativeSearch(name);
        if (key && !mentions.has(key)) mentions.set(key, name);
      }
    };

    // Termos pedidos pelo projeto permanecem disponíveis, além das menções reais.
    for (const name of ["Vorcaro", "André Janones", "Alexandre de Moraes", "STF", "Lula", "Flávio Bolsonaro"]) {
      addNames(name);
    }

    for (const source of Array.isArray(sources) ? sources : []) {
      const details = parseSourceSummary(source.summary || source.description || "");
      addNames(details.people);
      addNames(details.organizations);
      addNames(details.ficha?.people);
      addNames(details.ficha?.organizations);
    }

    // Inclui nomes normalizados pelo mural de entidades quando já carregado.
    for (const entity of Array.isArray(state.entities) ? state.entities : []) {
      const type = String(entity.type || entity.entity_type || "").toLocaleLowerCase("pt-BR");
      if (/person|pessoa|organization|organizacao|institution|instituicao|company|empresa/.test(type)) {
        addNames(entity.name || entity.label);
      }
    }

    const sorted = [...mentions.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    const options = [];
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Todas";
    options.push(allOption);

    for (const [, name] of sorted) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      options.push(option);
    }

    const previousKey = normalizeInvestigativeSearch(previous);
    if (previousKey && !mentions.has(previousKey)) {
      const option = document.createElement("option");
      option.value = previous;
      option.textContent = previous;
      options.push(option);
    }

    select.replaceChildren(...options);
    const match = previousKey ? mentions.get(previousKey) || previous : "";
    select.value = match;
    state.publicSourcePerson = select.value || "";
  }

  function renderPublicSources() {
    if (!elements.publicSourceList) return;
    const term = normalizeInvestigativeSearch(elements.search?.value || "");
    const personFilter = normalizeInvestigativeSearch(elements.sourcePersonFilter?.value || state.publicSourcePerson || "");
    const verdictFilter = elements.sourceVerdictFilter?.value || state.publicSourceVerdict || "";
    const mode = state.publicSourceMode || "all";
    const all = Array.isArray(state.publicSources) ? state.publicSources : [];
    renderSourcePersonFilter(all);
    const visible = all.filter((source) => {
      const d = parseSourceSummary(source.summary || source.description || "");
      const category = source.category || d.category || "Outros";
      const ficha = d.ficha || {};
      const claim = ficha.claim || null;
      const fact = claim?.fact_check || null;
      const isVideo = Boolean(ficha.video_id || youtubeId(source.media_url || ficha.media_url || source.url));
      const isImage = Boolean(ficha.image_url || (source.media_type === "image" && source.media_url));
      const isLegal = /process|justiça|sentença|tribunal|lei|medida|governo|decisão/i.test([category, source.title, d.cases, d.legalStatus].join(" "));
      const isCaseRecord = /caso|process|inquerito|condena|absolvi|anula|crime|denuncia|acusac/i.test([source.title, d.cases, d.legalStatus, d.summary, category].join(" "));
      const hasContradiction = Array.isArray(fact?.contradictory_sources) && fact.contradictory_sources.some((item) => Boolean(safeHttpUrl(item?.url)));
      const modeMatches = mode === "all" || (mode === "claims" && Boolean(claim?.quote)) || (mode === "media" && (isVideo || isImage)) || (mode === "legal" && isLegal) || (mode === "cases" && isCaseRecord) || (mode === "contradictions" && hasContradiction);
      const searchText = normalizeInvestigativeSearch([
        source.title, source.url, source.summary, source.description, category,
        d.people, d.organizations, d.cases, d.legalStatus, claim?.quote, claim?.speaker
      ].join(" "));
      const personMatches = !personFilter || searchText.includes(personFilter);
      const verdictMatches = !verdictFilter || fact?.verdict === verdictFilter;
      return modeMatches && personMatches && verdictMatches &&
        (!term || searchText.includes(term));
    });

    if (elements.boardSummary) {
      if (state.publicSourceStats?.queueAvailable === false) {
        elements.boardSummary.textContent = "Arquivo indisponível. A conexão com a base de registros falhou.";
      } else {
        const parts = [visible.length + (visible.length === 1 ? " registro" : " registros")];
        if (term || personFilter || verdictFilter || mode !== "all") parts.push("filtros aplicados");
        elements.boardSummary.textContent = parts.join(" · ");
      }
    }

    elements.publicSourceList.replaceChildren();
    if (!visible.length) {
      const message = state.publicSourceStats?.queueAvailable === false
        ? "Não foi possível consultar os registros. Tente atualizar novamente."
        : all.length
          ? "Nenhum registro corresponde aos filtros selecionados. Limpe os filtros para consultar todo o arquivo."
          : "Nenhum registro publicado está disponível. A rotina automática precisa localizar e processar fontes antes de criar fichas públicas.";
      elements.publicSourceList.appendChild(createMessage(message));
      return;
    }

    for (const source of visible) {
      const details = parseSourceSummary(source.summary || source.description || "");
      const ficha = details.ficha || {};
      const claim = ficha.claim || null;
      const fact = claim?.fact_check || null;
      const sourceUrl = source.url || source.original_url || "";
      const videoSourceUrl = ficha.video_source_url || [source.media_url, source.original_url, source.url, ficha.media_url]
        .find((value) => youtubeId(value)) || "";
      const candidateId = String(ficha.video_id || "");
      const videoId = /^[A-Za-z0-9_-]{11}$/.test(candidateId) ? candidateId : youtubeId(videoSourceUrl);
      const imageUrl = String(ficha.image_url || (source.media_type === "image" ? source.media_url : ""));
      const card = createElement("article", "public-source-card" + (videoId ? " has-video" : ""));
      const metadata = createElement("p", "source-card-meta");
      
      card.append(metadata, createElement("h3", "source-card-title", source.title || "Fonte sem título"));

      if (videoId) {
        const start = Math.max(0, Number(ficha.video_start || 0) || timestampSeconds(claim?.timestamp));
        const frame = createElement("iframe", "source-video-frame");
        frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + (start ? "?start=" + start : "");
        frame.title = "Vídeo original relacionado ao registro";
        frame.loading = "lazy";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.setAttribute("allowfullscreen", "");
        card.appendChild(frame);
        if (claim?.timestamp) card.appendChild(createElement("p", "source-video-timestamp", "Timestamp na transcrição: " + claim.timestamp));
        if (!ficha.transcript_available) card.appendChild(createElement("p", "source-media-note", "O vídeo está disponível, mas não foi encontrada transcrição pública utilizável. Nenhuma fala foi inferida."));
      } else if (/^https?:\/\//i.test(imageUrl)) {
        const link = createElement("a", "source-image-link");
        link.href = imageUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const image = createElement("img", "source-preview-image");
        image.src = imageUrl;
        image.alt = "Imagem associada ao registro";
        image.loading = "lazy";
        image.decoding = "async";
        link.appendChild(image);
        card.appendChild(link);
      }

      if (claim?.quote) {
        const claimBox = createElement("section", "source-claim-box");
        claimBox.appendChild(createElement("p", "eyebrow", claim.speaker ? "FALA ATRIBUÍDA A " + claim.speaker : "TRECHO CITADO NA FONTE"));
        claimBox.appendChild(createElement("blockquote", "source-claim-quote", "“" + claim.quote + "”"));
        if (claim.context) claimBox.appendChild(createElement("p", "source-claim-context", claim.context));
        if (claim.timestamp) claimBox.appendChild(createElement("p", "source-video-timestamp", "Timestamp: " + claim.timestamp));
        if (fact) {
          const labels = {
            verdadeira: "Verdadeira", falsa: "Falsa", enganosa: "Enganosa",
            fora_de_contexto: "Fora de contexto", inconclusiva: "Inconclusiva",
            nao_verificada: "Não verificada", opiniao_previsao: "Opinião, proposta ou previsão"
          };
          claimBox.appendChild(createElement("p", "fact-verdict verdict-" + fact.verdict, "Estado da checagem: " + (labels[fact.verdict] || "Não classificada")));
          claimBox.appendChild(createElement("p", "source-fact-explanation", fact.explanation || "Ainda não há evidências suficientes para explicar a classificação."));
          if (fact.context_note) claimBox.appendChild(createElement("p", "source-claim-context", fact.context_note));
          const evidence = createElement("details", "source-evidence-details");
          evidence.appendChild(createElement("summary", "", "Consultar evidências"));
          const grid = createElement("div", "source-evidence-grid");
          const groups = [
            { label: "Fontes que sustentam", items: fact.supporting_sources || [], empty: "Nenhuma fonte de apoio foi vinculada com confiança suficiente." },
            { label: "Fontes que contradizem ou limitam", items: fact.contradictory_sources || [], empty: "A pesquisa não conseguiu vincular uma fonte que contradiga ou limite diretamente esta afirmação. A ausência de contraponto na busca não prova que a afirmação seja verdadeira." }
          ];
          const shown = new Set();
          for (const group of groups) {
            const section = createElement("section", "source-evidence-group");
            section.appendChild(createElement("h4", "", group.label));
            if (!group.items.length) section.appendChild(createElement("p", "source-evidence-empty", group.empty));
            for (const item of group.items.slice(0, 3)) {
              const row = createElement("p", "source-evidence-link");
              appendSourceLink(row, item.url, item.title || "Abrir fonte consultada");
              if (item.excerpt) row.appendChild(createElement("small", "", item.excerpt));
              section.appendChild(row);
              if (item.url) shown.add(item.url);
            }
            grid.appendChild(section);
          }
          const otherSources = (fact.searched_sources || []).filter((item) => item.url && !shown.has(item.url)).slice(0, 4);
          if (otherSources.length) {
            const section = createElement("section", "source-evidence-group");
            section.appendChild(createElement("h4", "", "Outras fontes consultadas"));
            for (const item of otherSources) {
              const row = createElement("p", "source-evidence-link");
              appendSourceLink(row, item.url, item.title || "Abrir fonte consultada");
              section.appendChild(row);
            }
            grid.appendChild(section);
          }
          evidence.appendChild(grid);
          evidence.appendChild(createElement("p", "muted", "Resultado automático, sujeito a revisão editorial. Consulte as fontes originais antes de concluir."));
          claimBox.appendChild(evidence);
        } else {
          claimBox.appendChild(createElement("p", "fact-verdict verdict-nao_verificada", claim.verifiable ? "Estado da checagem: não verificada" : "Classificação: não é uma afirmação factual verificável"));
        }
        card.appendChild(claimBox);
      }

      if (details.eventDate || details.legalStatus) {
        const context = createElement("dl", "source-context-list");
        if (details.eventDate) {
          context.appendChild(createElement("dt", "", "Data mencionada"));
          context.appendChild(createElement("dd", "", details.eventDate));
        }
        if (details.legalStatus) {
          context.appendChild(createElement("dt", "", "Andamento informado pela fonte"));
          context.appendChild(createElement("dd", "", details.legalStatus));
        }
        card.appendChild(context);
      }
      if (details.summary) card.appendChild(createElement("p", "source-card-summary", details.summary));

      const extra = createElement("details", "source-points-details");
      extra.appendChild(createElement("summary", "", "Detalhes do registro"));
      const inner = createElement("div", "source-points-content");
      const information = [
        { label: "Pessoas citadas", value: details.people },
        { label: "Instituições", value: details.organizations },
        { label: "Casos e processos", value: details.cases }
      ].filter((item) => item.value);
      if (information.length) {
        const list = createElement("dl", "source-metadata");
        for (const entry of information) {
          list.appendChild(createElement("dt", "", entry.label));
          list.appendChild(createElement("dd", "", entry.value));
        }
        inner.appendChild(list);
      }
      if (details.points.length) {
        const list = createElement("ul", "source-key-points");
        for (const point of details.points) list.appendChild(createElement("li", "", point));
        inner.appendChild(list);
      }
      if (details.limitations) inner.appendChild(createElement("p", "source-limitation", "Limites da fonte: " + details.limitations));
      if (!inner.childNodes.length) inner.appendChild(createMessage("Não há outros detalhes estruturados neste registro."));
      extra.appendChild(inner);
      card.appendChild(extra);

      const footer = createElement("div", "source-card-footer");
      if (sourceUrl) appendSourceLink(footer, sourceUrl, "Abrir fonte original");
      if (videoSourceUrl) {
        const start = Math.max(0, Number(ficha.video_start || 0) || timestampSeconds(claim?.timestamp));
        appendSourceLink(footer, start ? videoTimestampUrl(videoSourceUrl, start) : videoSourceUrl, start ? "Abrir vídeo no trecho indicado" : "Abrir vídeo original");
      }
      if (!sourceUrl && !videoSourceUrl) footer.appendChild(createElement("span", "muted", "Texto fornecido sem URL original"));
      card.appendChild(footer);
      elements.publicSourceList.appendChild(card);
    }
  }

  async function loadPublicBoard() {
    if(!elements.publicSourceList||state.loadingPublicBoard)return;state.loadingPublicBoard=true;
    if(!state.publicSources.length)elements.publicSourceList.replaceChildren(createMessage("Consultando o banco e os feeds públicos…"));
    try {
      let data;
      try {
        const response = await fetch(API + "/sources", {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Falha ao carregar fontes (HTTP " + response.status + ").");
        }
      } catch (error) {
        // Só uma falha HTTP/rede marca a base como indisponível. Erro de interface
        // não pode ser apresentado como falha de conexão com o banco.
        state.publicSourceStats = { ...(state.publicSourceStats || {}), queueAvailable: false };
        elements.publicSourceList.replaceChildren(
          createMessage(error.message || "Não foi possível carregar fontes.", "error-message")
        );
        if (elements.boardSummary) {
          elements.boardSummary.textContent = error.message || "Não foi possível conectar ao banco de fontes.";
        }
        return;
      }

      state.publicSources = Array.isArray(data.sources) ? data.sources : [];
      state.publicSourceStats = { ...(data.stats || {}), queueAvailable: data.queueAvailable !== false };
      try {
        renderSourcePersonFilter(state.publicSources);
        renderPublicSources();
      } catch (error) {
        console.error("Falha ao exibir registros públicos:", error?.message || "Erro de interface");
        elements.publicSourceList.replaceChildren(
          createMessage("As fontes foram carregadas, mas houve uma falha ao exibi-las. Atualize a página.", "error-message")
        );
        if (elements.boardSummary) {
          elements.boardSummary.textContent = state.publicSources.length + " fontes carregadas; ocorreu um erro ao exibi-las.";
        }
      }
    } finally {
      state.loadingPublicBoard = false;
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
      renderSourcePersonFilter(state.publicSources);

      state.relationships = Array.isArray(relationshipData.relationships)
        ? relationshipData.relationships
        : [];
      if (elements.graphSection) elements.graphSection.hidden = false;
      if (elements.graphNavLink) elements.graphNavLink.hidden = false;

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
    const visibleEntities = state.entities.filter((entity) => [entity.name, entity.description, entity.type].some((value) => matchesSearch(value, term)));
    elements.graph.replaceChildren();
    if (!visibleEntities.length) { elements.graph.appendChild(createMessage(term ? 'Nenhuma ficha corresponde à pesquisa.' : 'O mural está pronto para exibir conexões quando houver fichas cadastradas.')); return; }
    const width = 1000, height = Math.max(430, Math.min(760, 250 + visibleEntities.length * 24));
    const positions = new Map();
    visibleEntities.forEach((entity, index) => { const angle = visibleEntities.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + 2 * Math.PI * index / visibleEntities.length; positions.set(entity.id, { x: width / 2 + Math.min(390, width * .39) * Math.cos(angle), y: height / 2 + Math.min(height * .37, 280) * Math.sin(angle) }); });
    const canvas = createElement('div', 'mural-canvas'); canvas.style.aspectRatio = width + ' / ' + height;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height); svg.setAttribute('aria-label', 'Conexões cadastradas');
    const ids = new Set(visibleEntities.map((entity) => entity.id));
    for (const relation of state.relationships) { if (!ids.has(relation.source_id) || !ids.has(relation.target_id)) continue; const a = positions.get(relation.source_id), b = positions.get(relation.target_id); if (!a || !b) continue; const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y); line.setAttribute('class', 'mural-edge'); svg.appendChild(line); }
    canvas.appendChild(svg);
    for (const entity of visibleEntities) { const p = positions.get(entity.id); const node = createElement('button', 'mural-person-node'); node.type = 'button'; node.style.left = p.x / width * 100 + '%'; node.style.top = p.y / height * 100 + '%'; node.setAttribute('aria-pressed', String(state.selectedEntityId === entity.id)); const photo = safeHttpUrl(entity.photo_url || entity.image_url || ''); if (photo) { const img = createElement('img', 'mural-person-photo'); img.src = photo; img.alt = ''; img.loading = 'lazy'; img.addEventListener('error', () => img.remove(), { once: true }); node.appendChild(img); } else { const initials = String(entity.name || '?').trim().split(/\s+/).slice(0,2).map((part) => part[0] || '').join('').toUpperCase(); node.appendChild(createElement('span', 'mural-person-initials', initials || '?')); } node.appendChild(createElement('span', 'mural-person-name', entity.name || 'Registro sem nome')); node.appendChild(createElement('span', 'mural-person-type', readableType(entity.type))); node.addEventListener('click', () => { state.selectedEntityId = entity.id; renderGraph(); renderEntityDetails(entity); }); canvas.appendChild(node); }
    elements.graph.appendChild(canvas);
    const related = state.relationships.filter((r) => ids.has(r.source_id) && ids.has(r.target_id));
    if (related.length) { const list = createElement('div', 'mural-relationship-list'); list.appendChild(createElement('h3', '', 'Ligações registradas')); for (const r of related) { const source = visibleEntities.find((e) => e.id === r.source_id), target = visibleEntities.find((e) => e.id === r.target_id); const card = createElement('article', 'mural-relationship-card'); card.appendChild(createElement('strong', '', (source?.name || 'Registro') + ' → ' + (target?.name || 'Registro'))); card.appendChild(createElement('p', '', r.label || r.relation_type || 'Relação')); if (r.description) card.appendChild(createElement('p', '', r.description)); if (r.source_date) card.appendChild(createElement('p', 'entity-source-meta', 'Data: ' + r.source_date)); if (r.evidence_status) card.appendChild(createElement('p', 'entity-source-meta', 'Estado: ' + r.evidence_status)); if (safeHttpUrl(r.source_url)) appendSourceLink(card, r.source_url, 'Consultar fonte da ligação'); list.appendChild(card); } elements.graph.appendChild(list); }
  }
  function renderEmptyDetails() {
    if (!elements.graphDetails) return;
    elements.graphDetails.replaceChildren();
    elements.graphDetails.hidden = true;
  }

  function renderEntityDetails(entity) {
    if (!elements.graphDetails || !entity) return;
    elements.graphDetails.hidden = false; elements.graphDetails.replaceChildren();
    const photo = safeHttpUrl(entity.photo_url || entity.image_url || '');
    if (photo) { const img = createElement('img', 'entity-detail-photo'); img.src = photo; img.alt = 'Imagem associada a ' + (entity.name || 'esta ficha'); img.loading = 'lazy'; img.addEventListener('error', () => img.remove(), { once: true }); elements.graphDetails.appendChild(img); }
    elements.graphDetails.appendChild(createElement('h3', '', entity.name || 'Registro'));
    elements.graphDetails.appendChild(createElement('p', 'entity-source-meta', readableType(entity.type) + ' · ' + (entity.evidence_status || 'Estado não informado') + (entity.source_date ? ' · Data: ' + entity.source_date : '')));
    if (entity.description) elements.graphDetails.appendChild(createElement('p', 'entity-source-summary', entity.description));
    if (safeHttpUrl(entity.source_url)) appendSourceLink(elements.graphDetails, entity.source_url, 'Fonte principal da ficha');
    elements.graphDetails.appendChild(createElement('p', 'section-description', 'Alegações, acusações ou investigações não equivalem a culpa comprovada. Confira as fontes e o contexto.'));
    const connected = state.relationships.filter((r) => r.source_id === entity.id || r.target_id === entity.id);
    if (connected.length) {
      elements.graphDetails.appendChild(createElement('h4', '', 'Conexões e acontecimentos'));
      const connections = createElement('div', 'entity-source-grid');
      for (const r of connected) { const otherId = r.source_id === entity.id ? r.target_id : r.source_id; const other = state.entities.find((e) => e.id === otherId); const card = createElement('article', 'entity-source-card'); card.appendChild(createElement('h4', 'entity-source-heading', (r.label || r.relation_type || 'Relação') + ' · ' + (other?.name || 'Registro relacionado'))); if (r.description) card.appendChild(createElement('p', 'entity-source-summary', r.description)); card.appendChild(createElement('p', 'entity-source-meta', (r.evidence_status || 'Estado não informado') + (r.source_date ? ' · ' + r.source_date : ''))); if (safeHttpUrl(r.source_url)) appendSourceLink(card, r.source_url, 'Fonte da relação'); connections.appendChild(card); }
      elements.graphDetails.appendChild(connections);
    }
    const personName = String(entity.name || '').trim().toLocaleLowerCase('pt-BR');
    const matchingRecords = (state.publicSources || []).filter((source) => { const details = parseSourceSummary(source.summary || source.description || ''); const people = String(details.people || '').toLocaleLowerCase('pt-BR'); const haystack = (String(source.title || '') + ' ' + String(source.summary || source.description || '')).toLocaleLowerCase('pt-BR'); return personName && (people.includes(personName) || haystack.includes(personName)); });
    const seen = new Set();
    const records = matchingRecords.filter((source) => { const url = String(source.url || source.original_url || '').trim(); const key = url || String(source.id || source.title || ''); if (!key || seen.has(key)) return false; seen.add(key); return true; });
    elements.graphDetails.appendChild(createElement('h4', '', 'Casos, notícias, acusações e registros relacionados'));
    const grid = createElement('div', 'entity-source-grid');
    if (!records.length) grid.appendChild(createMessage('Ainda não há fontes públicas vinculadas a esta ficha. Confira a fonte principal e as ligações cadastradas.'));
    else for (const source of records) { const details = parseSourceSummary(source.summary || source.description || ''); const card = createElement('article', 'entity-source-card'); card.appendChild(createElement('h4', 'entity-source-heading', details.cases || details.legalStatus || source.title || 'Registro relacionado')); if (details.eventDate) card.appendChild(createElement('p', 'entity-source-meta', 'Data mencionada: ' + details.eventDate)); if (details.summary) card.appendChild(createElement('p', 'entity-source-summary', details.summary)); const status = details.verdict || details.status || source.status || source.evidence_status; if (status) card.appendChild(createElement('p', 'entity-source-meta', 'Classificação: ' + status)); const url = source.url || source.original_url || ''; if (safeHttpUrl(url)) appendSourceLink(card, url, 'Consultar fonte original'); grid.appendChild(card); }
    elements.graphDetails.appendChild(grid);
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
      result.append(createElement("p", "ai-review-notice", "SUGESTÃO DE IA · NÃO SALVA NEM PUBLICA ESTA FICHA"));
      const heading = createElement("h4", "", `Resultado sugerido: ${({
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
    elements.sourcePersonFilter?.addEventListener("change", () => {
      state.publicSourcePerson = elements.sourcePersonFilter.value || "";
      renderPublicSources();
    });
    elements.sourceVerdictFilter?.addEventListener("change", () => {
      state.publicSourceVerdict = elements.sourceVerdictFilter.value || "";
      renderPublicSources();
    });
    elements.refreshDocuments?.addEventListener("click", loadDocuments);
    elements.refreshSourceQueue?.addEventListener("click", loadSourceQueue);
    elements.refreshTrash?.addEventListener("click", loadTrash);
    elements.processSourceQueue?.addEventListener("click", () => processSourceQueue());
    elements.retrySourceErrors?.addEventListener("click", () => processSourceQueue({ retryErrors: true }));
    elements.rebuildSourceConnections?.addEventListener("click", rebuildSourceConnections);
    elements.sourceQueueSearch?.addEventListener("input", renderSourceQueue);
    elements.sourceQueueStatusFilter?.addEventListener("change", renderSourceQueue);

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
      await Promise.allSettled([loadPublicBoard(), loadGraph()]);
      window.setInterval(() => { if (document.visibilityState !== "hidden") { loadPublicBoard(); loadGraph(); } }, 60000);
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
