-- ============================================================
-- CRI Platform - Initial Database Schema
-- Cultural Readiness Index (CRI)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  role          VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','superadmin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  gdpr_consent  BOOLEAN NOT NULL DEFAULT false,
  popia_consent BOOLEAN NOT NULL DEFAULT false,
  ndpa_consent  BOOLEAN NOT NULL DEFAULT false,
  consent_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  industry         VARCHAR(100),
  country          VARCHAR(100),
  stripe_customer_id TEXT UNIQUE,
  plan             VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise','trial')),
  plan_status      VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active','trialing','past_due','canceled','unpaid')),
  trial_ends_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_payment_intent  TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id        TEXT,
  amount_cents           INTEGER NOT NULL,
  currency               VARCHAR(10) NOT NULL DEFAULT 'usd',
  status                 VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded','canceled')),
  tier                   VARCHAR(50) NOT NULL CHECK (tier IN ('starter','pro','enterprise')),
  period_start           TIMESTAMPTZ,
  period_end             TIMESTAMPTZ,
  metadata               JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSESSMENTS
-- ============================================================
CREATE TABLE assessments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES users(id),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  target_country    VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
  target_industry   VARCHAR(100),
  status            VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','archived')),
  survey_token      VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  min_responses     INTEGER NOT NULL DEFAULT 5,
  response_count    INTEGER NOT NULL DEFAULT 0,
  dimension_weights JSONB NOT NULL DEFAULT '{
    "power_distance": 1.0,
    "individualism_collectivism": 1.0,
    "masculinity_femininity": 1.0,
    "uncertainty_avoidance": 1.0,
    "long_term_orientation": 1.0,
    "indulgence_restraint": 1.0,
    "communication_style": 1.0
  }',
  report_generated  BOOLEAN NOT NULL DEFAULT false,
  report_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RESPONSES (anonymous survey submissions)
-- ============================================================
CREATE TABLE responses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  session_token VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  answers       JSONB NOT NULL DEFAULT '{}',
  -- answers format: { "PD1": 4, "PD2": 3, "IC1": 5, ... }
  is_complete   BOOLEAN NOT NULL DEFAULT false,
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DIMENSION SCORES (computed after minimum responses met)
-- ============================================================
CREATE TABLE dimension_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Individual dimension scores (0-100 scale)
  power_distance            NUMERIC(5,2),
  individualism_collectivism NUMERIC(5,2),
  masculinity_femininity    NUMERIC(5,2),
  uncertainty_avoidance     NUMERIC(5,2),
  long_term_orientation     NUMERIC(5,2),
  indulgence_restraint      NUMERIC(5,2),
  communication_style       NUMERIC(5,2),
  -- Overall CRI score (0-100)
  overall_score   NUMERIC(5,2),
  colour_band     VARCHAR(20), -- 'green','amber','red'
  -- Benchmark deltas
  benchmark_deltas JSONB DEFAULT '{}',
  UNIQUE(assessment_id)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES payments(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
  pdf_url         TEXT,
  html_content    TEXT,
  llm_recommendations JSONB DEFAULT '{}',
  -- Structured report data
  executive_summary TEXT,
  strengths         JSONB DEFAULT '[]',
  development_areas JSONB DEFAULT '[]',
  action_steps      JSONB DEFAULT '[]',
  generated_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BENCHMARKS (seed data)
-- ============================================================
CREATE TABLE benchmarks (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country  VARCHAR(100) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  -- Dimension scores (Hofstede-derived, 0-100 scale)
  power_distance             NUMERIC(5,2),
  individualism_collectivism NUMERIC(5,2),
  masculinity_femininity     NUMERIC(5,2),
  uncertainty_avoidance      NUMERIC(5,2),
  long_term_orientation      NUMERIC(5,2),
  indulgence_restraint       NUMERIC(5,2),
  communication_style        NUMERIC(5,2),
  -- Hofstede national scores (raw, for reference)
  hofstede_pdi    INTEGER,
  hofstede_idv    INTEGER,
  hofstede_mas    INTEGER,
  hofstede_uai    INTEGER,
  hofstede_lto    INTEGER,
  hofstede_ind    INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country, industry)
);

-- ============================================================
-- EMAIL LOG (for tracking notifications)
-- ============================================================
CREATE TABLE email_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email    VARCHAR(255) NOT NULL,
  subject     VARCHAR(500) NOT NULL,
  type        VARCHAR(50) NOT NULL CHECK (type IN ('welcome','invite','reminder','report_ready','payment_confirmation','abandoned_cart')),
  assessment_id UUID REFERENCES assessments(id),
  organization_id UUID REFERENCES organizations(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at     TIMESTAMPTZ,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DATA DELETION REQUESTS (GDPR/POPIA/NDPA compliance)
-- ============================================================
CREATE TABLE data_deletion_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) NOT NULL,
  user_id     UUID REFERENCES users(id),
  reason      TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_assessments_org       ON assessments(organization_id);
CREATE INDEX idx_assessments_token     ON assessments(survey_token);
CREATE INDEX idx_assessments_status    ON assessments(status);
CREATE INDEX idx_responses_assessment  ON responses(assessment_id);
CREATE INDEX idx_responses_complete    ON responses(assessment_id, is_complete);
CREATE INDEX idx_dimension_scores_assessment ON dimension_scores(assessment_id);
CREATE INDEX idx_reports_assessment    ON reports(assessment_id);
CREATE INDEX idx_reports_status        ON reports(status);
CREATE INDEX idx_payments_org          ON payments(organization_id);
CREATE INDEX idx_benchmarks_country    ON benchmarks(country, industry);
CREATE INDEX idx_email_log_type        ON email_log(type, status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assessments_updated_at  BEFORE UPDATE ON assessments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at     BEFORE UPDATE ON payments     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reports_updated_at      BEFORE UPDATE ON reports      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
