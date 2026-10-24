import "dotenv/config";
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_STATUSES,
  cleanString,
  isIsoDate,
  isPdf,
  normalizeHttpUrl,
  sanitizeOriginalFilename,
  tokensMatch
} from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

// Vercel Functions têm filesystem de projeto somente leitura. Use /tmp
// para evitar que a inicialização falhe ao tentar criar arquivos em /var/task.
// ATENÇÃO: /tmp é efêmero; os dados SQLite não são persistentes entre instâncias.
const runtimeWritableDir = process.env.VERCEL
  ? path.join("/tmp", "fitasolta")
  : rootDir;
const dataDir = path.join(runtimeWritableDir, "data");
const uploadDir = path.join(runtimeWritableDir, "private_uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });

const PORT = Number.parseInt(process.env.PORT || "3333", 10);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET precisa existir e ter pelo menos 32 caracteres.");
}
if (!ADMIN_PASSWORD_HASH || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(ADMIN_PASSWORD_HASH)) {
  throw new Error("ADMIN_PASSWORD_HASH precisa conter um hash bcrypt válido.");
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT precisa ser uma porta válida entre 1 e 65535.");
}

const app = express();
app.disable("x-powered-by");
if (IS_PRODUCTION && process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

const SQLiteStore = connectSqlite3(session);
const db = new Database(path.join(dataDir, "tribunal.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

/* Cria as tabelas se não existirem. As migrações abaixo preservam tabelas existentes. */
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_date TEXT NOT NULL DEFAULT '',
    evidence_status TEXT NOT NULL DEFAULT 'nao_verificado',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    relation_type TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_date TEXT NOT NULL DEFAULT '',
    evidence_status TEXT NOT NULL DEFAULT 'nao_verificado',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    ip_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    stored_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table, column, definition) {
  const existing = db.pragma(`table_info(${table})`).some((entry) => entry.name === column);
  if (!existing) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Migrações aditivas para acomodar a estrutura anterior sem apagar os dados existentes.
const migrations = {
  entities: {
    type: "TEXT NOT NULL DEFAULT 'other'",
    description: "TEXT NOT NULL DEFAULT ''",
    source_url: "TEXT NOT NULL DEFAULT ''",
    source_date: "TEXT NOT NULL DEFAULT ''",
    evidence_status: "TEXT NOT NULL DEFAULT 'nao_verificado'",
    created_at: "TEXT",
    updated_at: "TEXT"
  },
  relationships: {
    source_id: "TEXT NOT NULL DEFAULT ''",
    target_id: "TEXT NOT NULL DEFAULT ''",
    label: "TEXT NOT NULL DEFAULT ''",
    relation_type: "TEXT NOT NULL DEFAULT ''",
    description: "TEXT NOT NULL DEFAULT ''",
    source_url: "TEXT NOT NULL DEFAULT ''",
    source_date: "TEXT NOT NULL DEFAULT ''",
    evidence_status: "TEXT NOT NULL DEFAULT 'nao_verificado'",
    created_at: "TEXT",
    updated_at: "TEXT"
  },
  audit_events: {
    action: "TEXT NOT NULL DEFAULT 'unknown'",
    target_type: "TEXT NOT NULL DEFAULT ''",
    target_id: "TEXT NOT NULL DEFAULT ''",
    ip_hash: "TEXT NOT NULL DEFAULT ''",
    created_at: "TEXT"
  },
  documents: {
    stored_name: "TEXT NOT NULL DEFAULT ''",
    original_name: "TEXT NOT NULL DEFAULT 'documento.pdf'",
    mime_type: "TEXT NOT NULL DEFAULT 'application/pdf'",
    size_bytes: "INTEGER NOT NULL DEFAULT 0",
    uploaded_at: "TEXT"
  }
};
for (const [table, columns] of Object.entries(migrations)) {
  for (const [column, definition] of Object.entries(columns)) ensureColumn(table, column, definition);
}

db.exec(`
  UPDATE entities SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
  UPDATE entities SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
  UPDATE relationships SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
  UPDATE relationships SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
  UPDATE relationships SET label = relation_type WHERE label = '' AND relation_type <> '';
  UPDATE relationships SET relation_type = label WHERE relation_type = '' AND label <> '';
  UPDATE audit_events SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
  UPDATE documents SET uploaded_at = COALESCE(uploaded_at, CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
  CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
  CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
`);

/* Auditoria: registra um hash do IP, não o IP em texto aberto. */
function getIpHash(ip) {
  return crypto.createHash("sha256")
    .update(`${SESSION_SECRET}:${ip || "unknown"}`)
    .digest("hex")
    .slice(0, 20);
}

const insertAudit = db.prepare(`
  INSERT INTO audit_events (action, target_type, target_id, ip_hash)
  VALUES (?, ?, ?, ?)
`);

function audit(req, action, targetType = "", targetId = "") {
  try {
    insertAudit.run(action, targetType, String(targetId || ""), getIpHash(req.ip));
  } catch (error) {
    console.error("Não foi possível registrar o evento de auditoria.");
  }
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.use(session({
  name: "fitasolta.sid",
  secret: SESSION_SECRET,
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir, concurrentDB: true }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    maxAge: 30 * 60 * 1000,
    path: "/"
  }
}));

/* Autenticação, CSRF e autorização */
function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function requireCsrf(req, res, next) {
  if (!tokensMatch(req.get("X-CSRF-Token"), req.session?.csrfToken)) {
    return res.status(403).json({ error: "Token de segurança inválido. Atualize a página e tente novamente." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin !== true) {
    return res.status(401).json({ error: "Entre na área administrativa para continuar." });
  }
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde antes de tentar novamente." }
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos envios de documentos. Aguarde antes de tentar novamente." }
});


/*
 * Leitura estritamente read-only da fila do Turso. As credenciais ficam
 * somente no servidor; nunca são enviadas ao navegador.
 */
function getTursoSourcesBaseUrl() {
  if (!TURSO_DATABASE_URL.trim() || !TURSO_AUTH_TOKEN.trim()) {
    const error = new Error("Integração com Turso não configurada.");
    error.code = "TURSO_NOT_CONFIGURED";
    throw error;
  }

  const normalizedUrl = TURSO_DATABASE_URL.trim().replace(/^libsql:\/\//i, "https://");
  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("URL do Turso inválida.");
  }

  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".turso.io")) {
    throw new Error("URL do Turso inválida.");
  }

  return parsedUrl.origin;
}

function sanitizeTursoSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }

    // Remove identificadores de sessão embutidos em caminhos de alguns sistemas judiciais.
    url.pathname = url.pathname.replace(/;jsessionid=[^/?;]+/i, "");
    return url.href;
  } catch {
    return "";
  }
}

async function readTursoSourceQueue() {
  const endpoint = `${getTursoSourcesBaseUrl()}/v2/pipeline`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_AUTH_TOKEN.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "SELECT id, url, status, title, summary, error_message, created_at, updated_at FROM source_queue ORDER BY created_at DESC LIMIT 200"
          }
        },
        { type: "close" }
      ]
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar Turso (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  const firstResult = payload?.results?.[0];
  const queryResult = firstResult?.response?.result;

  if (firstResult?.type !== "ok" || !Array.isArray(queryResult?.cols) || !Array.isArray(queryResult?.rows)) {
    throw new Error("O Turso retornou uma resposta de consulta inválida.");
  }

  const columnNames = queryResult.cols.map((column) => column.name);
  return queryResult.rows.map((row) => {
    const record = Object.fromEntries(
      columnNames.map((name, index) => {
        const cell = row[index];
        return [name, !cell || cell.type === "null" ? null : cell.value];
      })
    );

    const status = ["pending", "processing", "completed", "error"].includes(record.status)
      ? record.status
      : "error";

    return {
      id: String(record.id || ""),
      url: sanitizeTursoSourceUrl(record.url),
      status,
      title: String(record.title || ""),
      summary: String(record.summary || ""),
      error_message: String(record.error_message || ""),
      created_at: String(record.created_at || ""),
      updated_at: String(record.updated_at || "")
    };
  });
}


async function tursoExecute(sql, args = []) {
  const response = await fetch(`${getTursoSourcesBaseUrl()}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TURSO_AUTH_TOKEN.trim()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ requests: [
      { type: "execute", stmt: { sql, args: args.map((value) => value == null ? { type: "null" } : typeof value === "number" ? { type: "integer", value: String(value) } : { type: "text", value: String(value) }) } },
      { type: "close" }
    ] }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Turso write failed");
  const payload = await response.json();
  if (payload?.results?.[0]?.type !== "ok") throw new Error("Turso rejected operation");
  return payload.results[0].response?.result || null;
}

async function ensureInvestigationSchema() {
  await tursoExecute(`CREATE TABLE IF NOT EXISTS investigation_records (
    id TEXT PRIMARY KEY, record_type TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'nao_verificado',
    case_name TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL, source_title TEXT NOT NULL DEFAULT '',
    source_excerpt TEXT NOT NULL DEFAULT '', legal_outcome TEXT NOT NULL DEFAULT '',
    legal_reason TEXT NOT NULL DEFAULT '', related_people TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function readInvestigationRecords() {
  await ensureInvestigationSchema();
  const response = await fetch(`${getTursoSourcesBaseUrl()}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TURSO_AUTH_TOKEN.trim()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ requests: [
      { type: "execute", stmt: { sql: "SELECT id, record_type, title, description, status, case_name, event_date, source_url, source_title, source_excerpt, legal_outcome, legal_reason, related_people, created_at, updated_at FROM investigation_records ORDER BY updated_at DESC LIMIT 500" } },
      { type: "close" }
    ] }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Turso read failed");
  const payload = await response.json(), result = payload?.results?.[0]?.response?.result;
  if (payload?.results?.[0]?.type !== "ok" || !Array.isArray(result?.cols) || !Array.isArray(result?.rows)) throw new Error("Invalid query response");
  const cols = result.cols.map((column) => column.name);
  return result.rows.map((row) => Object.fromEntries(cols.map((name, i) => {
    const cell = row[i]; return [name, !cell || cell.type === "null" ? null : cell.value];
  }))).map((record) => {
    try { record.related_people = JSON.parse(record.related_people || "[]"); } catch { record.related_people = []; }
    if (!Array.isArray(record.related_people)) record.related_people = [];
    return record;
  });
}

const RECORD_TYPES = new Set(["pessoa", "caso", "crime", "investigacao", "decisao_judicial", "organizacao", "evento", "conexao"]);
const RECORD_STATUSES = new Set(["fato_documentado", "alegacao", "investigacao_em_andamento", "denuncia", "condenacao", "absolvicao", "soltura", "anulacao", "arquivamento", "hipotese", "nao_verificado"]);

app.get("/api/investigations", async (req, res) => {
  try { res.set("Cache-Control", "no-store").json({ records: await readInvestigationRecords() }); }
  catch { res.status(502).json({ error: "Não foi possível carregar os registros investigativos." }); }
});

app.post("/api/admin/investigations", requireAdmin, requireCsrf, async (req, res) => {
  const body = req.body || {};
  const recordType = cleanString(body.record_type, 40), title = cleanString(body.title, 240);
  const sourceUrl = normalizeHttpUrl(body.source_url), description = cleanString(body.description, 5000);
  const sourceTitle = cleanString(body.source_title, 300), sourceExcerpt = cleanString(body.source_excerpt, 3000);
  const caseName = cleanString(body.case_name, 240), eventDate = cleanString(body.event_date, 30);
  const legalOutcome = cleanString(body.legal_outcome, 1000), legalReason = cleanString(body.legal_reason, 3000);
  const status = cleanString(body.status, 40);
  const relatedPeople = Array.isArray(body.related_people) ? body.related_people.map((v) => cleanString(v, 160)).filter(Boolean).slice(0, 50) : [];
  if (!RECORD_TYPES.has(recordType) || !title || !sourceUrl || !RECORD_STATUSES.has(status)) return res.status(400).json({ error: "Informe tipo, título, situação e URL de fonte válida." });
  if (eventDate && !/^\\d{4}(-\\d{2}(-\\d{2})?)?$/.test(eventDate)) return res.status(400).json({ error: "Data inválida. Use AAAA, AAAA-MM ou AAAA-MM-DD." });
  try {
    await ensureInvestigationSchema();
    const id = crypto.randomUUID();
    await tursoExecute("INSERT INTO investigation_records (id, record_type, title, description, status, case_name, event_date, source_url, source_title, source_excerpt, legal_outcome, legal_reason, related_people) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, recordType, title, description, status, caseName, eventDate, sourceUrl, sourceTitle, sourceExcerpt, legalOutcome, legalReason, JSON.stringify(relatedPeople)]);
    audit(req, "investigation_record_created", recordType, id);
    res.status(201).json({ ok: true, id });
  } catch { res.status(502).json({ error: "Não foi possível salvar no banco persistente. Verifique a configuração do Turso." }); }
});

app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.set("Cache-Control", "no-store").json({ ok: true, app: "FitaSolta", database: "connected" });
  } catch {
    res.status(503).json({ ok: false, error: "Banco de dados indisponível." });
  }
});

app.get("/api/csrf", (req, res, next) => {
  if (!req.session.csrfToken) req.session.csrfToken = createCsrfToken();
  req.session.save((error) => {
    if (error) return next(error);
    res.set("Cache-Control", "no-store").json({ csrfToken: req.session.csrfToken });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.set("Cache-Control", "no-store").json({ isAdmin: req.session?.isAdmin === true });
});

app.post("/api/auth/login", loginLimiter, requireCsrf, (req, res, next) => {
  const password = req.body?.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    audit(req, "login_invalid_input", "admin");
    return res.status(400).json({ error: "Credenciais inválidas." });
  }

  bcrypt.compare(password, ADMIN_PASSWORD_HASH).then((validPassword) => {
    if (!validPassword) {
      audit(req, "login_failed", "admin");
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);
      req.session.isAdmin = true;
      req.session.csrfToken = createCsrfToken();
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        audit(req, "login_success", "admin");
        res.set("Cache-Control", "no-store").json({ ok: true, csrfToken: req.session.csrfToken });
      });
    });
  }).catch(next);
});

app.post("/api/auth/logout", requireCsrf, requireAdmin, (req, res, next) => {
  audit(req, "logout", "admin");
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("fitasolta.sid", {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "strict",
      path: "/"
    });
    res.set("Cache-Control", "no-store").json({ ok: true, message: "Sessão encerrada." });
  });
});

/* Entidades */
const selectEntities = db.prepare(`
  SELECT id, name, type, description, source_url, source_date, evidence_status, created_at, updated_at
  FROM entities ORDER BY created_at DESC LIMIT 500
`);
const insertEntity = db.prepare(`
  INSERT INTO entities (id, name, type, description, source_url, source_date, evidence_status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateEntity = db.prepare(`
  UPDATE entities SET name = ?, type = ?, description = ?, source_url = ?, source_date = ?, evidence_status = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

function parseEntity(body) {
  const name = cleanString(body?.name, { min: 1, max: 200, required: true });
  const type = cleanString(body?.type ?? "other", { min: 1, max: 60, required: true });
  const description = cleanString(body?.description ?? "", { max: 5000 });
  const sourceUrl = normalizeHttpUrl(body?.source_url ?? "");
  const sourceDate = body?.source_date ?? "";
  const evidenceStatus = body?.evidence_status ?? "nao_verificado";

  if (name === null || type === null || description === null) return { error: "Nome, categoria ou descrição inválidos." };
  if (sourceUrl === null) return { error: "A fonte precisa ser uma URL HTTP ou HTTPS válida." };
  if (!isIsoDate(sourceDate)) return { error: "A data da fonte precisa estar no formato AAAA-MM-DD." };
  if (!EVIDENCE_STATUSES.includes(evidenceStatus)) return { error: "Classificação de evidência inválida." };
  return { value: { name, type, description, source_url: sourceUrl, source_date: sourceDate || "", evidence_status: evidenceStatus } };
}

app.get("/api/entities", (req, res) => {
  try {
    res.set("Cache-Control", "no-store").json({ entities: selectEntities.all() });
  } catch (error) {
    console.error("Erro ao consultar entidades.");
    res.status(500).json({ error: "Não foi possível carregar as entidades." });
  }
});

app.post("/api/entities", requireCsrf, requireAdmin, (req, res) => {
  const parsed = parseEntity(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const id = crypto.randomUUID();
  const entity = parsed.value;
  insertEntity.run(id, entity.name, entity.type, entity.description, entity.source_url, entity.source_date, entity.evidence_status);
  audit(req, "entity_created", "entity", id);
  res.status(201).json({ ok: true, entity: { id, ...entity } });
});

app.put("/api/entities/:id", requireCsrf, requireAdmin, (req, res) => {
  const parsed = parseEntity(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const entity = parsed.value;
  const result = updateEntity.run(entity.name, entity.type, entity.description, entity.source_url, entity.source_date, entity.evidence_status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Entidade não encontrada." });
  audit(req, "entity_updated", "entity", req.params.id);
  res.json({ ok: true, entity: { id: req.params.id, ...entity } });
});

app.delete("/api/entities/:id", requireCsrf, requireAdmin, (req, res) => {
  const transaction = db.transaction((id) => {
    db.prepare("DELETE FROM relationships WHERE source_id = ? OR target_id = ?").run(id, id);
    return db.prepare("DELETE FROM entities WHERE id = ?").run(id);
  });
  const result = transaction(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Entidade não encontrada." });
  audit(req, "entity_deleted", "entity", req.params.id);
  res.json({ ok: true });
});

/* Relações */
const selectRelationships = db.prepare(`
  SELECT id, source_id, target_id, label, relation_type, description, source_url, source_date, evidence_status, created_at, updated_at
  FROM relationships ORDER BY created_at DESC LIMIT 2000
`);
function parseRelationship(body) {
  const sourceId = cleanString(body?.source_id, { min: 1, max: 100, required: true });
  const targetId = cleanString(body?.target_id, { min: 1, max: 100, required: true });
  const label = cleanString(body?.label ?? body?.relation_type, { min: 1, max: 160, required: true });
  const description = cleanString(body?.description ?? "", { max: 3000 });
  const sourceUrl = normalizeHttpUrl(body?.source_url ?? "");
  const sourceDate = body?.source_date ?? "";
  const evidenceStatus = body?.evidence_status ?? "nao_verificado";

  if ([sourceId, targetId, label, description].some((value) => value === null)) return { error: "Os campos da relação são inválidos." };
  if (sourceId === targetId) return { error: "Uma entidade não pode ser conectada a si mesma." };
  if (sourceUrl === null) return { error: "A fonte precisa ser uma URL HTTP ou HTTPS válida." };
  if (!isIsoDate(sourceDate)) return { error: "A data da fonte precisa estar no formato AAAA-MM-DD." };
  if (!EVIDENCE_STATUSES.includes(evidenceStatus)) return { error: "Classificação de evidência inválida." };
  return { value: { source_id: sourceId, target_id: targetId, label, relation_type: label, description, source_url: sourceUrl, source_date: sourceDate || "", evidence_status: evidenceStatus } };
}

app.get("/api/relationships", (req, res) => {
  try {
    res.set("Cache-Control", "no-store").json({ relationships: selectRelationships.all() });
  } catch (error) {
    console.error("Erro ao consultar relações.");
    res.status(500).json({ error: "Não foi possível carregar as relações." });
  }
});

app.post("/api/relationships", requireCsrf, requireAdmin, (req, res) => {
  const parsed = parseRelationship(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const relationship = parsed.value;
  const source = db.prepare("SELECT id FROM entities WHERE id = ?").get(relationship.source_id);
  const target = db.prepare("SELECT id FROM entities WHERE id = ?").get(relationship.target_id);
  if (!source || !target) return res.status(400).json({ error: "As duas entidades precisam existir antes de criar a relação." });

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO relationships (id, source_id, target_id, label, relation_type, description, source_url, source_date, evidence_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, relationship.source_id, relationship.target_id, relationship.label, relationship.relation_type, relationship.description, relationship.source_url, relationship.source_date, relationship.evidence_status
  );
  audit(req, "relationship_created", "relationship", id);
  res.status(201).json({ ok: true, relationship: { id, ...relationship } });
});

app.put("/api/relationships/:id", requireCsrf, requireAdmin, (req, res) => {
  const parsed = parseRelationship(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const relationship = parsed.value;
  const source = db.prepare("SELECT id FROM entities WHERE id = ?").get(relationship.source_id);
  const target = db.prepare("SELECT id FROM entities WHERE id = ?").get(relationship.target_id);
  if (!source || !target) return res.status(400).json({ error: "As duas entidades precisam existir antes de salvar a relação." });

  const result = db.prepare(`UPDATE relationships SET source_id = ?, target_id = ?, label = ?, relation_type = ?, description = ?, source_url = ?, source_date = ?, evidence_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    relationship.source_id, relationship.target_id, relationship.label, relationship.relation_type, relationship.description, relationship.source_url, relationship.source_date, relationship.evidence_status, req.params.id
  );
  if (!result.changes) return res.status(404).json({ error: "Relação não encontrada." });
  audit(req, "relationship_updated", "relationship", req.params.id);
  res.json({ ok: true, relationship: { id: req.params.id, ...relationship } });
});

app.delete("/api/relationships/:id", requireCsrf, requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM relationships WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Relação não encontrada." });
  audit(req, "relationship_deleted", "relationship", req.params.id);
  res.json({ ok: true });
});

/* Documentos privados: upload validado, listado e baixado apenas por administrador. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 3, parts: 4 },
  fileFilter(req, file, callback) {
    if (path.extname(file.originalname).toLowerCase() !== ".pdf" || file.mimetype !== "application/pdf") {
      return callback(new Error("Envie somente arquivos PDF."));
    }
    callback(null, true);
  }
});

app.get("/api/documents", requireAdmin, (req, res) => {
  const documents = db.prepare(`SELECT id, original_name, mime_type, size_bytes, uploaded_at FROM documents ORDER BY uploaded_at DESC LIMIT 200`).all();
  res.set("Cache-Control", "no-store").json({ documents });
});

app.post("/api/documents", uploadLimiter, requireCsrf, requireAdmin, upload.single("file"), async (req, res, next) => {
  let storedPath;
  try {
    if (!req.file) return res.status(400).json({ error: "Selecione um arquivo PDF." });
    if (!isPdf(req.file.buffer)) {
      audit(req, "document_rejected", "document");
      return res.status(400).json({ error: "O conteúdo do arquivo não parece ser um PDF válido." });
    }

    const id = crypto.randomUUID();
    const storedName = `${id}.pdf`;
    const originalName = sanitizeOriginalFilename(req.file.originalname);
    storedPath = path.join(uploadDir, storedName);

    await fs.promises.writeFile(storedPath, req.file.buffer, { flag: "wx", mode: 0o600 });
    try {
      db.prepare(`INSERT INTO documents (id, stored_name, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)`).run(
        id, storedName, originalName, "application/pdf", req.file.size
      );
    } catch (databaseError) {
      await fs.promises.unlink(storedPath).catch(() => {});
      storedPath = undefined;
      throw databaseError;
    }

    audit(req, "document_uploaded", "document", id);
    res.status(201).json({
      ok: true,
      document: { id, originalName, sizeBytes: req.file.size },
      message: "PDF armazenado em área privada. A extração de texto e a análise automática ainda não estão implementadas."
    });
  } catch (error) {
    if (storedPath) await fs.promises.unlink(storedPath).catch(() => {});
    next(error);
  }
});

app.get("/api/documents/:id/download", requireAdmin, (req, res, next) => {
  const document = db.prepare("SELECT stored_name, original_name FROM documents WHERE id = ?").get(req.params.id);
  if (!document) return res.status(404).json({ error: "Documento não encontrado." });
  if (!/^[0-9a-f-]+\.pdf$/i.test(document.stored_name)) return res.status(500).json({ error: "Nome interno de arquivo inválido." });
  const filePath = path.join(uploadDir, document.stored_name);
  res.download(filePath, document.original_name, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

app.delete("/api/documents/:id", requireCsrf, requireAdmin, async (req, res, next) => {
  try {
    const document = db.prepare("SELECT stored_name FROM documents WHERE id = ?").get(req.params.id);
    if (!document) return res.status(404).json({ error: "Documento não encontrado." });
    db.prepare("DELETE FROM documents WHERE id = ?").run(req.params.id);
    if (/^[0-9a-f-]+\.pdf$/i.test(document.stored_name)) {
      await fs.promises.unlink(path.join(uploadDir, document.stored_name)).catch(() => {});
    }
    audit(req, "document_deleted", "document", req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});


app.get("/api/sources", async (req, res) => {
  try {
    const sources = await readTursoSourceQueue();
    res.set("Cache-Control", "no-store").json({
      sources: sources.map(({ id, url, status, title, summary, created_at, updated_at }) => ({
        id, url, status, title, summary, created_at, updated_at
      }))
    });
  } catch (error) {
    const notConfigured = error?.code === "TURSO_NOT_CONFIGURED";
    console.error("Não foi possível carregar as fontes públicas.");
    res.status(notConfigured ? 503 : 502).json({
      error: notConfigured
        ? "O banco de fontes ainda não está configurado."
        : "Não foi possível consultar o banco de fontes. Tente novamente mais tarde."
    });
  }
});

app.get("/api/admin/sources", requireAdmin, async (req, res) => {
  try {
    const sources = await readTursoSourceQueue();
    audit(req, "source_queue_view", "source_queue");
    res.set("Cache-Control", "no-store").json({ sources });
  } catch (error) {
    const notConfigured = error?.code === "TURSO_NOT_CONFIGURED";
    console.error("Não foi possível consultar as fontes do Turso.");
    res.status(notConfigured ? 503 : 502).json({
      error: notConfigured
        ? "Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no ambiente do servidor para habilitar a fila de fontes."
        : "Não foi possível carregar as fontes do Turso. Confira a URL, o token e a tabela source_queue."
    });
  }
});

app.get("/api/admin/audit", requireAdmin, (req, res) => {
  try {
    audit(req, "audit_view", "audit_events");
    const events = db.prepare(`SELECT id, action, target_type, target_id, ip_hash, created_at FROM audit_events ORDER BY id DESC LIMIT 200`).all();
    res.set("Cache-Control", "no-store").json({ events });
  } catch (error) {
    console.error("Erro ao consultar auditoria.");
    res.status(500).json({ error: "Não foi possível consultar a auditoria." });
  }
});

app.use(express.static(publicDir, {
  index: "index.html",
  dotfiles: "deny",
  etag: true,
  maxAge: IS_PRODUCTION ? "1h" : 0
}));

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Rota da API não encontrada." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "O arquivo ultrapassa o limite de 10 MB." : "Não foi possível receber o arquivo enviado."
    });
  }
  if (error?.message === "Envie somente arquivos PDF.") {
    return res.status(400).json({ error: error.message });
  }
  console.error("Erro interno do servidor:", error?.message || "erro desconhecido");
  return res.status(500).json({ error: "Ocorreu um erro interno. Tente novamente." });
});

const server = app.listen(PORT, () => {
  console.log(`FitaSolta iniciado na porta ${PORT}.`);
  console.log(`Modo: ${NODE_ENV}`);
});

function shutdown(signal) {
  console.log(`${signal}: encerrando FitaSolta...`);
  server.close(() => {
    try { db.close(); } finally { process.exit(0); }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
