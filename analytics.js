/* Analytics opcional e sem rastreadores de terceiros.
   Não envia dados para fora do navegador. Só registra contagens locais após consentimento. */
(() => {
  const KEY = "tc-analytics-consent";
  const NOTICE_KEY = "tc-cookie-notice-dismissed";
  const notice = document.getElementById("cookie-notice");
  const dismiss = document.getElementById("cookie-dismiss");

  try {
    if (notice && localStorage.getItem(NOTICE_KEY) !== "yes") notice.hidden = false;
    if (dismiss) dismiss.addEventListener("click", () => {
      localStorage.setItem(NOTICE_KEY, "yes");
      notice.hidden = true;
    });
    // Nenhum evento é transmitido a servidor/terceiro. A coleta local está desativada por padrão.
    window.tcAnalytics = {
      count(eventName) {
        if (localStorage.getItem(KEY) !== "yes") return;
        const allowed = new Set(["page_view", "search", "document_upload_started"]);
        if (!allowed.has(eventName)) return;
        const key = "tc-local-analytics";
        const counts = JSON.parse(localStorage.getItem(key) || "{}");
        counts[eventName] = (counts[eventName] || 0) + 1;
        localStorage.setItem(key, JSON.stringify(counts));
      },
      enableLocalAnalytics() { localStorage.setItem(KEY, "yes"); },
      disableLocalAnalytics() { localStorage.removeItem(KEY); localStorage.removeItem("tc-local-analytics"); }
    };
  } catch {
    // Se o navegador bloquear storage, a aplicação continua sem analytics.
    window.tcAnalytics = { count() {}, enableLocalAnalytics() {}, disableLocalAnalytics() {} };
  }
})();

/*
 * Contadores estritamente locais à aba. Nenhum evento é enviado a um servidor
 * de analytics ou a terceiros. Remova este arquivo e as chamadas tcAnalytics
 * se não precisar desses contadores temporários.
 */
(() => {
  "use strict";
  const counters = Object.create(null);

  window.tcAnalytics = Object.freeze({
    count(name) {
      if (typeof name !== "string" || !/^[a-z0-9_]{1,60}$/i.test(name)) return;
      counters[name] = (counters[name] || 0) + 1;
    },
    snapshot() {
      return { ...counters };
    }
  });
})();