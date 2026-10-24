-- FitaSolta / Turso (libSQL)
-- Esquema de referência. O servidor também executa CREATE TABLE IF NOT EXISTS
-- na inicialização; preserve dados existentes ao aplicar atualizações.

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

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_queue (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  speaker TEXT NOT NULL,
  claim_date TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'video_original',
  timestamp TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'outros',
  location TEXT NOT NULL DEFAULT '',
  claim_type TEXT NOT NULL DEFAULT 'factual',
  verdict TEXT NOT NULL DEFAULT 'nao_verificada',
  explanation TEXT NOT NULL DEFAULT '',
  supporting_evidence TEXT NOT NULL DEFAULT '',
  contradictory_evidence TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS claim_sources (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'outra',
  side TEXT NOT NULL DEFAULT 'context',
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  publisher TEXT NOT NULL DEFAULT '',
  published_date TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_reviews (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'manual',
  input_snapshot TEXT NOT NULL,
  output_json TEXT NOT NULL,
  reviewer_decision TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_relations (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  related_claim_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'related',
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (related_claim_id) REFERENCES claims(id) ON DELETE CASCADE,
  CHECK (claim_id <> related_claim_id)
);

CREATE TABLE IF NOT EXISTS claim_entities (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'relates_to',
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (claim_id, entity_id, relation_type),
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_versions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS correction_reports (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topic_votes (
  id TEXT PRIMARY KEY,
  poll_period TEXT NOT NULL,
  topic TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  vote_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (poll_period, vote_key)
);

CREATE TABLE IF NOT EXISTS aggregate_analytics (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  resource TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (day, event, resource)
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_sources_publisher ON sources(publisher);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS idx_claims_status_date ON claims(status, claim_date);
CREATE INDEX IF NOT EXISTS idx_claims_speaker ON claims(speaker);
CREATE INDEX IF NOT EXISTS idx_claims_topic ON claims(topic);
CREATE INDEX IF NOT EXISTS idx_claim_sources_claim ON claim_sources(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_reviews_claim ON claim_reviews(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_relations_claim ON claim_relations(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_versions_claim ON claim_versions(claim_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_topic_votes_period ON topic_votes(poll_period);
CREATE INDEX IF NOT EXISTS idx_aggregate_analytics_day ON aggregate_analytics(day);
