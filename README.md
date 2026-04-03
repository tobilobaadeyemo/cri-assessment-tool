# Cultural Readiness Index (CRI) Platform

A premium SaaS tool that measures an organisation's emotional, ethical, and visual preparedness for entering new markets — starting with Africa.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Research Foundation](#research-foundation)
3. [Quick Start (Local Development)](#quick-start-local-development)
4. [Database Setup](#database-setup)
5. [Environment Variables](#environment-variables)
6. [Stripe Setup](#stripe-setup)
7. [Email Configuration](#email-configuration)
8. [Deployment (VPS / AWS / DigitalOcean)](#deployment)
9. [MCP Scoring Server API](#mcp-scoring-server-api)
10. [Scoring Algorithm](#scoring-algorithm)
11. [GDPR / POPIA / NDPA Compliance](#compliance)
12. [WCAG 2.1 AA Accessibility](#accessibility)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser / Client                   │
│              frontend/index.html (SPA)               │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────────┐
│               Nginx Reverse Proxy                    │
│              (docker/nginx.conf)                     │
└──────┬───────────────────────────┬──────────────────┘
       │ /api/*                    │ static files
┌──────▼────────┐         ┌────────▼──────────────────┐
│  Backend API  │         │  Frontend (served static)  │
│  Express/TS   │         │  frontend/index.html       │
│  Port 8080    │         └───────────────────────────┘
└──────┬────────┘
       │
┌──────▼────────────────────────────────────────────┐
│               PostgreSQL 16                        │
│   users · organizations · assessments             │
│   responses · dimension_scores · reports          │
│   payments · benchmarks · email_log               │
└───────────────────────────────────────────────────┘
       │
┌──────▼────────┐
│  MCP Server   │  POST /score  →  CRI scoring algorithm
│  Port 3001    │  GET  /dimensions
└───────────────┘
       │
┌──────▼────────┐
│  Anthropic    │  claude-sonnet-4-20250514
│  API (LLM)    │  Enterprise report recommendations
└───────────────┘
       │
┌──────▼────────┐
│  Stripe API   │  $299 Starter · $2,500 Enterprise
│  + Webhooks   │  One-time payment model
└───────────────┘
```

---

## Research Foundation

The CRI is built on **Hofstede's 6-D Model of National Culture** with a 7th dimension for Communication Style, adapted for African workplace contexts based on peer-reviewed research.

### 7 Cultural Dimensions

| # | Dimension | Key (DB) | Description |
|---|-----------|----------|-------------|
| 1 | Hierarchy & Authority | `power_distance` | Acceptance of unequal power. Nigeria PD = 80 (high). |
| 2 | Team & Community Orientation | `individualism_collectivism` | Group loyalty vs. individual. Nigeria IDV = 30 (collectivist). |
| 3 | Drive for Achievement | `masculinity_femininity` | Competition vs. quality of life. Nigeria MAS = 60. |
| 4 | Attitude to Rules & Risk | `uncertainty_avoidance` | Tolerance for ambiguity. Nigeria UAI = 55 (moderate). |
| 5 | Time Perception & Tradition | `long_term_orientation` | Short vs. long-term focus. Nigeria LTO = 13 (short-term). |
| 6 | Work-Life Integration | `indulgence_restraint` | Enjoyment vs. restraint. Nigeria IND = 84 (indulgent). |
| 7 | Communication Style | `communication_style` | Direct vs. indirect/high-context. |

### Scoring Rubric

- **Scale:** 5-point Likert (1 = Strongly Disagree, 5 = Strongly Agree)
- **Scoring types:**
  - `direct`: raw score = Likert value
  - `inverse`: score = 6 − Likert value (reverses scale for negatively-worded items)
- **Normalization:** `(average − 1) / 4 × 100` → 0–100 scale
- **Weighted overall CRI:** weighted mean of 7 dimension scores
- **Colour bands:** 🟢 Green 70–100 (High) · 🟡 Amber 40–69 (Moderate) · 🔴 Red 0–39 (Developing)

### Question Bank — Nigeria (24 questions)

| Dimension | Question IDs | Count |
|-----------|-------------|-------|
| Power Distance | PD1–PD4 | 4 |
| Individualism-Collectivism | IC1–IC4 | 4 |
| Masculinity-Femininity | MF1–MF4 | 4 |
| Uncertainty Avoidance | UA1–UA4 | 4 |
| Long-Term Orientation | LTO1–LTO3 | 3 |
| Indulgence-Restraint | IR1–IR3 | 3 |
| Communication Style | CS1–CS3 | 3 |

### Extending to Other Countries

Follow this methodology (documented in `database/migrations/002_seed_data.sql`):
1. Research Hofstede/GLOBE scores for the target country
2. Consult local HR professionals for cultural nuances
3. Adapt question language for local context (e.g. "boss" → culturally appropriate term)
4. Pilot test with small group in-country
5. Add benchmark row to `benchmarks` table; add questions to `question_bank` table

### Benchmark Countries

| Country | PD | IDV | MAS | UAI | LTO | IND |
|---------|-----|-----|-----|-----|-----|-----|
| Nigeria | 80 | 30 | 60 | 55 | 13 | 84 |
| Ghana | 80 | 15 | 40 | 65 | 4 | 72 |
| Kenya | 70 | 25 | 60 | 50 | 25 | — |
| South Africa | 49 | 65 | 63 | 49 | 34 | 63 |
| Egypt | 70 | 25 | 45 | 80 | 7 | 4 |
| Ethiopia | 70 | 20 | 65 | 55 | 25 | 46 |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### 1. Clone & Install

```bash
git clone <your-repo-url> cri-platform
cd cri-platform
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in all required values
```

### 3. Start with Docker Compose

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432 (auto-runs migrations)
- Backend API on port 8080
- MCP Scoring Server on port 3001
- Frontend + Nginx on port 80

### 4. Verify everything is running

```bash
curl http://localhost:8080/health
# → {"status":"ok","timestamp":"..."}

curl http://localhost:3001/health
# → {"status":"ok","service":"cri-mcp-server","version":"1.0.0"}
```

### 5. Open the app

Open [http://localhost](http://localhost) in your browser.

Register a new account — the first user created will have admin access.

---

## Database Setup

Migrations run automatically on first Docker start via `docker-entrypoint-initdb.d/`.

To run manually:

```bash
# Connect to postgres container
docker exec -it cri-postgres psql -U cri_user -d cri_db

# Or run migrations directly
psql $DATABASE_URL -f database/migrations/001_initial_schema.sql
psql $DATABASE_URL -f database/migrations/002_seed_data.sql
```

### Promote a user to superadmin

```sql
UPDATE users SET role = 'superadmin' WHERE email = 'your@email.com';
```

---

## Environment Variables

All variables are documented in `.env.example`. The critical ones:

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | JWT signing secret (64+ random chars) | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `POSTGRES_PASSWORD` | Database password | ✅ |
| `STRIPE_API_KEY` | Stripe secret key | ✅ |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | Stripe webhook secret | ✅ |
| `STRIPE_PRICE_STARTER` | Stripe Price ID for $299 plan | ✅ |
| `STRIPE_PRICE_ENTERPRISE` | Stripe Price ID for $2,500 plan | ✅ |
| `LLM_PROVIDER_API_KEY` | Anthropic API key | ✅ |
| `MAIL_HOST` | SMTP server hostname | ✅ |
| `MAIL_USER` / `MAIL_PASS` | SMTP credentials | ✅ |
| `FRONTEND_URL` | Public URL of frontend | ✅ |
| `CORS_ORIGIN` | Allowed CORS origin | ✅ |

---

## Stripe Setup

### 1. Create products in Stripe Dashboard

Go to [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products):

**Starter Plan — $299**
- Product name: "CRI Starter Report"
- Price: $299.00 USD, one-time

**Enterprise Plan — $2,500**
- Product name: "CRI Enterprise Report"
- Price: $2,500.00 USD, one-time

Copy each **Price ID** (starts with `price_`) into `.env`.

### 2. Create a Webhook

Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks):
- Endpoint URL: `https://app.yourdomain.com/api/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the **Signing Secret** (starts with `whsec_`) into `.env`.

### 3. Test Stripe locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:8080/api/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

---

## Email Configuration

### Recommended providers

| Provider | Free tier | Setup |
|----------|-----------|-------|
| **SendGrid** | 100/day | `MAIL_HOST=smtp.sendgrid.net`, `MAIL_USER=apikey`, `MAIL_PASS=<API key>` |
| **AWS SES** | 62k/month (EC2) | Configure SMTP credentials in IAM |
| **Mailgun** | 100/day | `MAIL_HOST=smtp.mailgun.org` |
| **Postmark** | 100/month | `MAIL_HOST=smtp.postmarkapp.com` |

### Email types sent

| Trigger | Type | Recipient |
|---------|------|-----------|
| Admin registers | `welcome` | Admin |
| Admin invites participants | `invite` | Each participant |
| 3 days after invite, no response | `reminder` | Participant |
| Min responses reached | `report_ready` | Admin |
| Stripe payment succeeded | `payment_confirmation` | Admin |
| Checkout abandoned (cron) | `abandoned_cart` | Admin |

### Abandoned cart reminder (cron job)

The `processReminderQueue()` function in `emailService.ts` should be called on a schedule. Add to your cron or use a job queue like BullMQ:

```bash
# Crontab — runs every hour
0 * * * * curl -X POST http://localhost:8080/api/internal/process-reminders
```

---

## Deployment

### Option A: DigitalOcean Droplet (recommended for cost)

```bash
# 1. Create a Droplet (Ubuntu 24.04, 2 vCPU / 4GB RAM minimum)
# 2. SSH in and install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Clone your repo
git clone <repo-url> /opt/cri-platform
cd /opt/cri-platform

# 4. Configure environment
cp .env.example .env
nano .env  # Fill in all values

# 5. Start
docker compose up -d

# 6. Set up SSL with Certbot
apt install certbot python3-certbot-nginx
certbot --nginx -d app.yourdomain.com
```

### Option B: AWS EC2

```bash
# Launch EC2 t3.medium (Ubuntu 24.04)
# Open ports 80, 443 in security group

# Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl start docker

# Deploy (same as DigitalOcean steps 3-6)
```

### Option C: AWS ECS / EKS (production scale)

For high-traffic production:
1. Build and push images to ECR:
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker build -t cri-backend ./backend
   docker tag cri-backend:latest <ECR_URI>/cri-backend:latest
   docker push <ECR_URI>/cri-backend:latest
   ```
2. Use RDS PostgreSQL instead of containerised Postgres
3. Deploy via ECS Fargate or EKS
4. Use Application Load Balancer with SSL termination
5. Store secrets in AWS Secrets Manager

### Updating the application

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## MCP Scoring Server API

The MCP server runs independently and exposes the CRI scoring algorithm as a REST API.

### POST /score

Compute CRI scores from survey responses.

**Request:**
```json
{
  "responses": [
    {
      "answers": {
        "PD1": 4, "PD2": 5, "PD3": 3, "PD4": 4,
        "IC1": 5, "IC2": 4, "IC3": 5, "IC4": 4,
        "MF1": 3, "MF2": 3, "MF3": 2, "MF4": 4,
        "UA1": 4, "UA2": 2, "UA3": 5, "UA4": 4,
        "LTO1": 4, "LTO2": 3, "LTO3": 2,
        "IR1": 5, "IR2": 1, "IR3": 4,
        "CS1": 4, "CS2": 2, "CS3": 4
      }
    }
  ],
  "weights": {
    "power_distance": 1.2,
    "communication_style": 0.8
  },
  "benchmarks": {
    "power_distance": 75,
    "individualism_collectivism": 35,
    "masculinity_femininity": 65,
    "uncertainty_avoidance": 55,
    "long_term_orientation": 16,
    "indulgence_restraint": 84,
    "communication_style": 70
  }
}
```

**Response:**
```json
{
  "dimensionScores": {
    "power_distance": 75.00,
    "individualism_collectivism": 81.25,
    "masculinity_femininity": 56.25,
    "uncertainty_avoidance": 62.50,
    "long_term_orientation": 50.00,
    "indulgence_restraint": 83.33,
    "communication_style": 66.67
  },
  "overallScore": 68.28,
  "colourBand": "amber",
  "benchmarkDeltas": {
    "power_distance": 0.00,
    "individualism_collectivism": 46.25
  },
  "responseCount": 1
}
```

### GET /dimensions

Returns dimension definitions, question IDs, and scoring types.

### POST /score/validate

Validate a set of answers before submission — returns missing/unknown/invalid question IDs.

---

## Scoring Algorithm

The complete algorithm is in `backend/src/services/scoringEngine.ts` and mirrored in `mcp-server/src/index.ts`.

```
For each response:
  For each question answer (question_id → likert_value):
    if scoring_type == "direct":
      scored_value = likert_value
    else (inverse):
      scored_value = 6 - likert_value

Dimension raw score:
  avg = mean of all scored_values for that dimension
  (across all responses × all questions in dimension)

Normalise to 0–100:
  dimension_score = (avg - 1) / (5 - 1) × 100
                  = (avg - 1) / 4 × 100

Weighted overall CRI:
  overall = Σ(dimension_score × weight) / Σ(weights)
  default weight = 1.0 for all dimensions

Colour band:
  overall ≥ 70  →  GREEN  (High Readiness)
  overall ≥ 40  →  AMBER  (Moderate Readiness)
  overall < 40  →  RED    (Developing Readiness)
```

### Inverse-scored questions

These items are reversed because agreement indicates the OPPOSITE cultural orientation:

| Question | Why inverse |
|----------|-------------|
| MF2 "I prefer collaborative over competitive" | High score → FEMININE orientation |
| MF3 "Work-life balance over salary" | High score → FEMININE |
| UA2 "Comfortable with unclear requirements" | High score → LOW uncertainty avoidance |
| LTO3 "Willing to invest for distant payoff" | High score → LONG-TERM orientation |
| IR2 "Work taken very seriously, separate from enjoyment" | High score → RESTRAINED |
| CS2 "I prefer precise, explicit communication" | High score → LOW-CONTEXT / DIRECT |

---

## Compliance

### GDPR / POPIA / Nigeria NDPA 2023

The platform is designed to comply with all three frameworks:

#### Lawful Basis
- Employee surveys: **Legitimate Interest** (not Consent — to avoid the employer-employee power imbalance)
- Document your Legitimate Interest Assessment (LIA)

#### Implemented Compliance Features

| Requirement | Implementation |
|-------------|----------------|
| Cookie consent | `CookieBanner` component (shown on all pages) |
| Data minimisation | No PII collected from survey respondents |
| Anonymisation | Scores only generated when ≥5 responses (prevents de-identification) |
| Data subject rights | `POST /api/data-deletion-request` endpoint |
| Cross-border transfer | Standard Contractual Clauses (SCCs) — add to your DPA |
| Privacy Policy link | Shown in cookie banner, survey footer, registration form |
| Consent checkbox | Registration form requires explicit tick with link to Privacy Policy |
| Audit log | `email_log` table tracks all communications |

#### Data Deletion Request Endpoint

```bash
POST /api/data-deletion-request
Content-Type: application/json

{
  "email": "user@example.com",
  "reason": "Right to erasure under GDPR Article 17"
}
```

Implement a manual process (or automate) to delete user data within 30 days of request.

#### Cross-Border Transfers (NDPA 2023)

If you store Nigerian residents' data on US servers:
- Implement **Standard Contractual Clauses (SCCs)** between your entity and Anthropic/AWS/Stripe
- Reference these in your Privacy Policy
- Document in your Records of Processing Activities (ROPA)

---

## Accessibility

The platform targets **WCAG 2.1 Level AA** compliance.

### Implemented

- **Perceivable:** All form inputs have `<label>` associations. Images have `alt` text. Colour is never the sole means of conveying information (text labels accompany colour bands).
- **Operable:** All interactive elements are keyboard-focusable. Navigation uses `role="navigation"` with `aria-label`. Survey uses `role="radiogroup"` and `aria-label` on Likert scales. `id="main-content"` skip target.
- **Understandable:** Error messages are descriptive. Form hints explain requirements. Language is `lang="en"`.
- **Robust:** Valid semantic HTML. ARIA roles and `aria-*` attributes on dynamic content. `role="progressbar"` on survey progress with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.

### Additional steps before launch

1. Test with a screen reader (NVDA/VoiceOver)
2. Run [axe DevTools](https://www.deque.com/axe/) browser extension
3. Verify colour contrast ratios (4.5:1 minimum for normal text) with a contrast checker
4. Test keyboard-only navigation through the full survey flow

---

## Troubleshooting

### Database connection fails

```bash
# Check postgres is healthy
docker compose ps postgres
docker compose logs postgres

# Test connection
docker exec -it cri-postgres psql -U cri_user -d cri_db -c "SELECT 1;"
```

### Stripe webhook not firing

```bash
# Check the webhook secret matches exactly (no trailing spaces)
echo $STRIPE_WEBHOOK_SIGNING_SECRET

# Use Stripe CLI to forward events locally
stripe listen --forward-to localhost:8080/api/webhook
```

### Emails not sending

```bash
# Check backend logs
docker compose logs backend | grep -i email

# Test SMTP credentials
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({host:'$MAIL_HOST',port:587,auth:{user:'$MAIL_USER',pass:'$MAIL_PASS'}});
t.verify().then(console.log).catch(console.error);
"
```

### LLM recommendations not generating

- Check `LLM_PROVIDER_API_KEY` is set and valid
- Enterprise tier only — verify `organizations.plan = 'enterprise'`
- Check `backend/logs/error.log` for Anthropic API errors

### Survey scores not computing

- Need minimum 5 complete responses (configurable via `min_responses`)
- Check all 24 question IDs are present in the response
- Use `POST /score/validate` on the MCP server to debug missing questions

---

## File Structure

```
cri-platform/
├── README.md                          # This file
├── docker-compose.yml                 # Full stack orchestration
├── .env.example                       # Environment variable template
├── .gitignore
│
├── database/
│   └── migrations/
│       ├── 001_initial_schema.sql     # All 8 tables + indexes + triggers
│       └── 002_seed_data.sql          # Benchmarks + question bank (24 Qs)
│
├── backend/                           # Node.js / Express / TypeScript API
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # Express server + middleware
│       ├── lib/
│       │   ├── db.ts                  # PostgreSQL connection pool
│       │   └── logger.ts              # Winston logger
│       ├── middleware/
│       │   ├── auth.ts                # JWT authentication
│       │   └── errorHandler.ts
│       ├── routes/
│       │   ├── auth.ts                # Register, login, /me
│       │   ├── assessments.ts         # CRUD + invite + compute
│       │   ├── survey.ts              # Public survey endpoint
│       │   ├── reports.ts             # Report view + download
│       │   ├── payments.ts            # Stripe checkout
│       │   ├── webhook.ts             # Stripe webhook handler
│       │   └── admin.ts               # Superadmin panel
│       └── services/
│           ├── scoringEngine.ts       # CRI algorithm (canonical)
│           ├── reportGenerator.ts     # HTML report + LLM recommendations
│           └── emailService.ts        # All 6 email types
│
├── mcp-server/                        # Independent CRI scoring MCP server
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                   # POST /score · GET /dimensions
│
├── frontend/
│   └── index.html                     # Complete SPA (React + Chart.js CDN)
│
└── docker/
    └── nginx.conf                     # Reverse proxy + security headers
```

---

## Pricing Model Reference

As specified in research documentation:

| Tier | Price | Target | Key Features |
|------|-------|--------|-------------|
| **Starter** | $299 one-time | Teams < 50 | Scores, benchmarks, HTML report |
| **Enterprise** | $2,500 one-time | Unlimited | All Starter + AI recommendations (Claude) |

**Cost per report (LLM):**
- Input: 5,000 tokens × $3/1M = $0.015
- Output: 10,000 tokens × $15/1M = $0.15
- **Total: ~$0.165 per Enterprise report** (Claude Sonnet 4.6)

**Break-even analysis (from research):**
- Monthly fixed costs: ~$33,348 (2 engineers, hosting, marketing)
- Break-even: ~4,170 active users at avg $8/user/month
- Optimistic (10k users at $7): $36,652/month profit

---

## License

This codebase is provided as-is for the Cultural Readiness Index platform. All cultural dimension data is derived from publicly available Hofstede research.

---

*CRI Platform v1.0.0 — Built for African market expansion*
