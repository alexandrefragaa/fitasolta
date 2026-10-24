-- FitaSolta: modelo relacional para investigações e checagem.
-- Migração aditiva para Turso/libSQL. Revise em staging antes de aplicar em produção.
-- Não adiciona dados de pessoas; apenas estrutura.

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'outro',
  jurisdiction TEXT NOT NULL DEFAULT '',
  responsible_agency TEXT NOT NULL DEFAULT '',
  official_reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'triagem',
  opened_at TEXT,
  last_checked_at TEXT,
  next_review_at TEXT,
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (editorial_status IN ('draft','in_review','approved','published','rejected','withdrawn'))
);

CREATE TABLE IF NOT EXISTS case_entities (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL,
  role_description TEXT NOT NULL DEFAULT '',
  valid_from TEXT,
  valid_to TEXT,
  source_id TEXT,
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  CHECK (editorial_status IN ('draft','in_review','approved','published','rejected','withdrawn'))
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  speaker_entity_id TEXT,
  speaker_label TEXT NOT NULL DEFAULT '',
  literal_quote TEXT NOT NULL,
  context_before TEXT NOT NULL DEFAULT '',
  context_after TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  locator TEXT NOT NULL DEFAULT '',
  claim_type TEXT NOT NULL DEFAULT 'factual',
  verdict TEXT NOT NULL DEFAULT 'nao_verificada',
  verdict_explanation TEXT NOT NULL DEFAULT '',
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (speaker_entity_id) REFERENCES entities(id) ON DELETE SET NULL,
  CHECK (verdict IN ('verdadeira','falsa','enganosa','imprecisa','fora_de_contexto','inconclusiva','opiniao_nao_verificavel','nao_verificada','corrigida','retirada')),
  CHECK (editorial_status IN ('draft','in_review','approved','published','rejected','withdrawn'))
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'outra',
  published_at TEXT,
  accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  primary_source INTEGER NOT NULL DEFAULT 0,
  content_excerpt TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'not_checked',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(canonical_url),
  CHECK (primary_source IN (0,1)),
  CHECK (verification_status IN ('not_checked','accessible','verified','broken','disputed'))
);

CREATE TABLE IF NOT EXISTS claim_sources (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  evidence_direction TEXT NOT NULL DEFAULT 'contextualizes',
  exact_excerpt TEXT NOT NULL DEFAULT '',
  page_or_timestamp TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  CHECK (evidence_direction IN ('supports','contradicts','contextualizes','background'))
);

CREATE TABLE IF NOT EXISTS case_sources (
  case_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relevance_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, source_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT,
  document_date TEXT,
  published_date TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'not_checked',
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
  CHECK (verification_status IN ('not_checked','verified','disputed','corrected')),
  CHECK (editorial_status IN ('draft','in_review','approved','published','rejected','withdrawn'))
);

CREATE TABLE IF NOT EXISTS evidence_relations (
  id TEXT PRIMARY KEY,
  from_type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  valid_from TEXT,
  valid_to TEXT,
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
  CHECK (from_type IN ('entity','case','claim','source','event')),
  CHECK (to_type IN ('entity','case','claim','source','event')),
  CHECK (editorial_status IN ('draft','in_review','approved','published','rejected','withdrawn'))
);

CREATE TABLE IF NOT EXISTS editorial_reviews (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (decision IN ('approved','rejected','changes_requested','withdrawn'))
);

CREATE TABLE IF NOT EXISTS record_versions (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_reason TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_type, record_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, editorial_status);
CREATE INDEX IF NOT EXISTS idx_case_entities_case ON case_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_case ON claims(case_id, editorial_status);
CREATE INDEX IF NOT EXISTS idx_claims_verdict ON claims(verdict, editorial_status);
CREATE INDEX IF NOT EXISTS idx_claim_sources_claim ON claim_sources(claim_id);
CREATE INDEX IF NOT EXISTS idx_case_events_timeline ON case_events(case_id, event_date);
CREATE INDEX IF NOT EXISTS idx_evidence_relations_from ON evidence_relations(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relations_to ON evidence_relations(to_type, to_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_lookup ON record_versions(record_type, record_id, version_number);
