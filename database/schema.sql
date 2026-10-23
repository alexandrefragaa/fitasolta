  label TEXT NOT NULL DEFAULT '',
  relation_type TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  source_ref_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_date TEXT NOT NULL DEFAULT '',
  evidence_status TEXT NOT NULL DEFAULT 'nao_verificado',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'em_analise',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_entities (
  case_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (case_id, entity_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS legal_conclusions (
  entity_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT '',
  what_did TEXT NOT NULL DEFAULT '',
  what_accused TEXT NOT NULL DEFAULT '',
  what_proven TEXT NOT NULL DEFAULT '',
  what_unproven TEXT NOT NULL DEFAULT '',
  justice_decided TEXT NOT NULL DEFAULT '',
  current_status TEXT NOT NULL DEFAULT '',
  summary_what_we_know TEXT NOT NULL DEFAULT '',
  summary_what_justice_decided TEXT NOT NULL DEFAULT '',
  summary_what_unproven TEXT NOT NULL DEFAULT '',
  summary_current_status TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  pages INTEGER,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded',
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_sources_publisher ON sources(publisher);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
