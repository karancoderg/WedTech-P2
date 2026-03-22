# 📈 Scalability Evaluation Report — WedSync

## 📌 Project Information

- **Project Name:** WedSync (WedTech)
- **Project Type:** Full-Stack Web Application + Chrome Extension
- **Description:** WedSync is a production-grade Indian wedding RSVP & guest management platform built on Next.js 16 (App Router), Supabase (PostgreSQL + RLS), and Clerk authentication. It consolidates guest management, multi-event RSVP collection, AI voice calls, QR check-in, analytics, and bulk communication into a single system.
- **Main Feature Modules:** Multi-Event RSVP Engine, Guest Management, WhatsApp Bulk Sender (Chrome Extension), AI Voice RSVP (Tabbly), AI Seating Plans (Gemini), Email Invitations (Nodemailer), QR Check-In Kiosk, Real-Time Analytics Dashboard.

---

## 🎯 Objective

This document evaluates the end-to-end scalability of WedSync, covering:

- Performance limits of each subsystem
- Bottleneck identification at the architecture, database, API, and client layers
- System behaviour under load (concurrent weddings, high guest counts, burst RSVP submissions)
- Concrete improvements for scaling from MVP to production SaaS

---

# 🏗️ 1. Current Architecture Analysis

## 1.1 Architecture Overview

WedSync follows a **server-rendered monolithic architecture** using Next.js App Router:

| Layer | Technology | Scaling Model |
|-------|-----------|---------------|
| **Frontend** | React 19 Server Components + Client Components | Vercel Edge CDN (horizontal) |
| **API Layer** | Next.js Route Handlers (`/api/*`) | Vercel Serverless Functions (horizontal, stateless) |
| **Database** | Supabase PostgreSQL + Row-Level Security | Managed, connection-pooled (PgBouncer) |
| **Auth** | Clerk (middleware-level) | Clerk-managed infrastructure |
| **Email** | Nodemailer (SMTP per planner) | Sequential, per-request |
| **AI — Voice** | Tabbly REST API + Webhook | Third-party managed |
| **AI — Seating** | Google Gemini (GenAI SDK) | Third-party managed |
| **WhatsApp** | Chrome Extension (Manifest V3) | Client-side only, single-user |

**Architecture Type:** Hybrid — server-rendered monolith with client-side extension sidecar.

---

## 1.2 Data Flow

### Flow A: Planner → Dashboard (Server-Side)

```
Browser → Clerk Middleware (auth verify) → Next.js Server Component → Supabase (service-role query) → RSC HTML Payload → Browser
```

### Flow B: Guest → RSVP (Token-Based Public Route)

```
Guest clicks invite link → Server Component resolves token → Fetches wedding/guest/function data → Renders themed page
Guest submits RSVP → POST /api/wedding/[id]/rsvp → Supabase UPSERT → Realtime broadcast → Planner dashboard updates
```

### Flow C: WhatsApp Bulk Send (Client-Side Extension)

```
Planner exports JSON payload (clipboard) → Pastes into extension popup → popup.js validates & sends to background.js
→ background.js enqueues contacts → Navigates WhatsApp Web tab to /send?phone=X&text=Y
→ content.js detects send URL → Waits for Send button → Clicks → Reports MESSAGE_SENT → 5–8s delay → Next contact
```

### Flow D: AI Voice RSVP (Server ↔ External)

```
Planner triggers call → POST /api → Tabbly REST API (outbound call)
Guest answers → Tabbly AI conducts conversation → Tabbly sends webhook → POST /api/webhooks/tabbly → Supabase UPDATE
```

---

# 🚨 2. Bottleneck Identification

## 2.1 Database Layer — Supabase PostgreSQL

| Bottleneck | Severity | Detail |
|-----------|----------|--------|
| **Connection limits** | 🟡 Medium | Supabase Free tier: ~20 direct connections. Each serverless function invocation opens a new connection. Under burst load (50+ concurrent RSVP submissions), connections exhaust rapidly. |
| **Service-role key usage** | 🔴 High | Server components use `createClient(url, serviceRoleKey)` — this bypasses RLS for server reads but creates a new client instance per request. No connection pooling at the application level. |
| **No query caching** | 🟡 Medium | Every Server Component render triggers a fresh Supabase query. No Redis/in-memory cache layer for frequently accessed data (wedding details, function lists). |
| **Realtime subscription cost** | 🟢 Low | Supabase Realtime is event-based; manageable at current scale but becomes expensive with thousands of concurrent planners. |

## 2.2 API Layer — Next.js Route Handlers

| Bottleneck | Severity | Detail |
|-----------|----------|--------|
| **Cold starts** | 🟡 Medium | Serverless functions on Vercel have cold start latency (~200–500ms). Burst RSVP submissions during peak wedding season hit cold starts concurrently. |
| **Sequential email sending** | 🔴 High | `EmailService.sendInvitation()` sends emails one at a time using `transporter.sendMail()`. Sending 500 invitations = 500 sequential SMTP connections. No batching, no queue. A single API request sending bulk emails will timeout. |
| **No request rate limiting** | 🔴 High | API routes have no rate limiting middleware. A malicious actor could spam `/api/wedding/[id]/rsvp` or exhaust Tabbly API quotas. |
| **Synchronous AI calls** | 🟡 Medium | Gemini seating plan generation blocks the request until the LLM responds. Large guest lists (500+ guests) may exceed Vercel's function timeout (10s default, 60s max on Pro). |

## 2.3 Chrome Extension — WhatsApp Bulk Sender

| Bottleneck | Severity | Detail |
|-----------|----------|--------|
| **DOM dependency** | 🔴 High | [content.js](file:///home/karandeep/Desktop/WedTech/app/whatsapp-bulk-sender/content.js) relies on `document.querySelector('span[data-icon="send"]')` and XPath queries against WhatsApp Web's DOM. Any UI update by Meta breaks the extension silently. |
| **Sequential processing** | 🔴 High | Messages are sent strictly one-at-a-time. Each message takes ~8–11 seconds (5–8s intentional delay + 1s pre-click + 2s post-click wait). 500 guests = ~90 minutes minimum. |
| **No persistence across sessions** | 🟡 Medium | If the user closes the browser mid-batch, `chrome.storage.local` retains `queue` and `currentIndex`, but the process doesn't auto-resume — requires manual restart. |
| **Single-tab bottleneck** | 🔴 High | `chrome.tabs.update(activeTabId, { url })` reuses a single tab. Only one WhatsApp Web session can run at a time. No parallelism. |
| **No retry/dead-letter queue** | 🟡 Medium | Invalid numbers trigger `INVALID_NUMBER` action and skip to next. No logging of which contacts failed, no retry mechanism, no failure report exported back to the dashboard. |
| **Service worker lifecycle** | 🟡 Medium | Manifest V3 service workers are terminated after ~30s of inactivity. The 5–8s delay between messages keeps it alive, but extended pauses or system sleep could kill the process. |

## 2.4 Authentication Layer — Clerk

| Bottleneck | Severity | Detail |
|-----------|----------|--------|
| **Middleware on every request** | 🟢 Low | `clerkMiddleware` runs on every non-API, non-static request. Clerk's Edge SDK is fast, but adds latency per request. At extreme scale, this is a measurable overhead. |
| **No role-based access** | 🟡 Medium | Current implementation only checks "authenticated vs. not". No planner-level roles (admin, assistant, view-only). Limits multi-user collaboration on a single wedding. |

## 2.5 External Service Dependencies

| Service | Bottleneck | Severity |
|---------|-----------|----------|
| **Tabbly AI** | Rate limits unknown; single point of failure for voice RSVP. No fallback if Tabbly is down. | 🟡 Medium |
| **Google Gemini** | Token limits on large prompts (500+ guests with full metadata). API rate limits apply. | 🟡 Medium |
| **SMTP (per planner)** | Gmail: 500 emails/day limit. Outlook: 300/day. Per-planner SMTP throttling is uncontrolled. | 🔴 High |

---

# 📈 3. Scalability Analysis

## 3.1 Horizontal Scaling

| Component | Horizontally Scalable? | Detail |
|-----------|----------------------|--------|
| **Next.js (Vercel)** | ✅ Yes | Serverless functions auto-scale per request. Zero persistent state. |
| **Supabase** | ⚠️ Partially | Connection pooling (PgBouncer) required on Pro plan. Read replicas available on Team/Enterprise. |
| **Clerk** | ✅ Yes | Fully managed, scales automatically. |
| **Chrome Extension** | ❌ No | Runs locally per user. Cannot be centralized or distributed. |
| **Email (Nodemailer)** | ❌ No | Sequential, per-planner SMTP. No centralized sending infrastructure. |
| **Tabbly AI** | ⚠️ Partially | API-dependent. No control over their infrastructure scaling. |

## 3.2 Vertical Scaling

| Component | Benefit from Vertical Scale | Detail |
|-----------|---------------------------|--------|
| **Supabase** | ✅ High | Higher-tier plans = more RAM, CPU, connections, storage. Direct performance improvement. |
| **Vercel Functions** | ⚠️ Moderate | Pro plan increases function timeout (10s → 60s), memory (1 GB → 3 GB). Helps with AI generation. |
| **Chrome Extension** | ❌ None | Constrained by browser sandbox, not hardware. |

## 3.3 Multi-Tenancy

| Aspect | Current State | Scalability Impact |
|--------|--------------|-------------------|
| **Data Isolation** | ✅ RLS on `planner_id` | Strong — database enforced, not application enforced. Scales cleanly. |
| **Resource Isolation** | ❌ Shared compute | All planners share the same serverless functions and database. No per-tenant resource limits. |
| **SMTP Isolation** | ✅ Per-planner SMTP config | Good — each planner uses their own email server. But no monitoring of per-planner send volume. |

---

# 🧩 4. Component-Specific Limitations

## 4.1 Chrome Extension (WhatsApp Bulk Sender)

| Limitation | Impact |
|-----------|--------|
| Runs inside browser sandbox → CPU/memory constrained | Cannot process large contact lists efficiently |
| Content scripts depend on WhatsApp Web DOM → fragile | Any Meta UI update breaks automation silently |
| No true backend control → process lives and dies with the browser tab | Long batches (500+) are unreliable |
| No analytics/logging → planner has no visibility into delivery success | Cannot track delivery rates or retry failures |
| Single-user execution → not multi-tenant | Each planner runs their own instance locally |

## 4.2 Email Sending (Nodemailer)

| Limitation | Impact |
|-----------|--------|
| Sequential `sendMail()` calls → O(n) time complexity | 500 emails at ~1s each = ~8 minutes blocking |
| No queue → API timeout kills the operation | Bulk sends > 30 emails likely fail on serverless |
| Per-planner SMTP limits unmonitored | Gmail quota exhaustion causes silent failures |
| No bounce/delivery tracking | Planner has no visibility into email deliverability |

## 4.3 Server Components (Data Fetching)

| Limitation | Impact |
|-----------|--------|
| New Supabase client per request → no connection reuse | Connection churn under load |
| No caching layer → identical queries re-execute | Unnecessary database load for repeated page views |
| No pagination on large datasets | Guest list pages with 1000+ guests fetch all rows at once |

---

# ⚙️ 5. Performance Analysis

## 5.1 Response Time Estimates Under Load

| Operation | 10 guests | 100 guests | 500 guests | 1000+ guests |
|-----------|----------|-----------|-----------|-------------|
| Guest list page load | ~200ms | ~400ms | ~900ms | ~2s+ (no pagination) |
| RSVP submission | ~150ms | ~150ms | ~150ms | ~150ms (single guest, stable) |
| Bulk email send (sync) | ~10s | ~100s | ⛔ Timeout | ⛔ Timeout |
| WhatsApp bulk send | ~2 min | ~18 min | ~90 min | ~3 hrs (unreliable) |
| AI seating plan (Gemini) | ~3s | ~5s | ~12s | ⛔ May timeout (prompt too large) |
| Analytics dashboard load | ~300ms | ~500ms | ~800ms | ~1.5s (aggregate queries) |
| QR check-in scan | ~100ms | ~100ms | ~100ms | ~100ms (single lookup, stable) |
| Excel export | ~500ms | ~1s | ~3s | ~5s+ (memory-intensive) |

## 5.2 Concurrent Wedding Stress Test (Theoretical)

| Metric | 10 weddings | 100 weddings | 1000 weddings |
|--------|------------|-------------|--------------|
| Database connections (peak) | ~30 | ~300 | ⛔ Connection exhaustion |
| Realtime subscriptions | ~10 | ~100 | 🟡 Supabase plan limit |
| Serverless function invocations/min | ~50 | ~500 | ✅ Vercel auto-scales |
| SMTP connections (concurrent) | ~10 | ~100 | ⛔ SMTP server limits |

---

# 🔐 6. Reliability & Failure Points

## 6.1 Critical Failure Scenarios

| Scenario | Likelihood | Impact | Mitigation (Current) |
|----------|-----------|--------|---------------------|
| WhatsApp Web DOM change | 🔴 High (Meta updates frequently) | Extension breaks completely | ❌ None — manual code update required |
| Supabase connection exhaustion | 🟡 Medium (burst load) | API errors, failed RSVP saves | ❌ No connection pooling config |
| Planner SMTP quota exceeded | 🟡 Medium (Gmail 500/day) | Emails silently fail | ❌ No quota tracking |
| Vercel function timeout | 🟡 Medium (AI/bulk ops) | 500 error, partial operation | ❌ No background job system |
| Tabbly webhook failure | 🟡 Medium | Voice RSVP data lost | ❌ No webhook retry/dead-letter |
| Browser crash during WhatsApp bulk | 🟡 Medium (long batches) | Partial send, no recovery | ⚠️ Partial — `chrome.storage.local` retains state |
| Clerk outage | 🟢 Low | All planner auth fails | ❌ No fallback auth |
| Supabase outage | 🟢 Low | Entire system down | ❌ No fallback database |

## 6.2 Data Integrity Risks

| Risk | Detail |
|------|--------|
| **Partial RSVP saves** | If aggregate counter update fails after RSVP insert, counts drift from actual data |
| **Service-role key exposure** | Server-side only, but a single leaked key grants full database access across all tenants |
| **No idempotency on webhooks** | Tabbly webhook replay could duplicate RSVP entries |

---

# 🚀 7. Scalability Improvements

## 7.1 Database Layer

| Improvement | Priority | Effort | Impact |
|------------|----------|--------|--------|
| Enable Supabase PgBouncer (connection pooling) | 🔴 Critical | Low — config change | Eliminates connection exhaustion under burst load |
| Add database indexes on `invite_token`, `wedding_id`, `planner_id` (verify existing) | 🟡 Medium | Low | O(log n) lookups guaranteed |
| Implement cursor-based pagination for guest lists | 🔴 Critical | Medium | Prevents full-table fetches on large weddings |
| Add Redis/Upstash caching for wedding/function metadata | 🟡 Medium | Medium | Reduces repeated identical queries by ~80% |
| Implement read replicas for analytics queries | 🟢 Low | Low — Supabase config | Separates read load from write path |

## 7.2 Email Infrastructure

| Improvement | Priority | Effort | Impact |
|------------|----------|--------|--------|
| Introduce background job queue (Inngest / Trigger.dev / BullMQ via Supabase Edge Functions) | 🔴 Critical | High | Enables async bulk email without API timeout |
| Per-planner SMTP rate limiting and quota tracking | 🟡 Medium | Medium | Prevents silent failures from quota exhaustion |
| Add delivery tracking (bounce detection, open tracking) | 🟡 Medium | Medium | Gives planners visibility into email performance |
| Fall back to transactional service (Resend/SendGrid) when planner SMTP is unconfigured | 🟢 Low | Low | Improves onboarding experience |

## 7.3 WhatsApp Bulk Sender

| Improvement | Priority | Effort | Impact |
|------------|----------|--------|--------|
| Add failure logging & export (JSON report of sent/failed/skipped) | 🔴 Critical | Low | Planners can identify and retry failed contacts |
| Implement auto-resume on browser restart | 🟡 Medium | Low | Uses existing `chrome.storage.local` state |
| Add DOM selector versioning with fallback selectors | 🟡 Medium | Medium | More resilient to WhatsApp Web UI changes |
| Long-term: Migrate to WhatsApp Cloud API (Meta Business) | 🟢 Future | High | Server-side, scalable, but expensive ($0.05–$0.08/message) |

## 7.4 API Layer

| Improvement | Priority | Effort | Impact |
|------------|----------|--------|--------|
| Add rate limiting middleware (e.g., Vercel KV-based or Upstash) | 🔴 Critical | Low | Prevents abuse and SMTP quota burn |
| Move long-running operations (AI seating, bulk email) to background jobs | 🔴 Critical | High | Eliminates function timeouts |
| Add webhook idempotency keys for Tabbly | 🟡 Medium | Low | Prevents duplicate RSVP entries from webhook replays |
| Implement request queuing for Gemini API calls | 🟡 Medium | Medium | Handles rate limits gracefully |

## 7.5 Monitoring & Observability

| Improvement | Priority | Effort | Impact |
|------------|----------|--------|--------|
| Add structured logging (Axiom / LogTail integration) | 🟡 Medium | Low | Debug production issues, track error rates |
| Implement health checks and uptime monitoring | 🟡 Medium | Low | Early warning for service degradation |
| Add per-wedding analytics on send volumes | 🟢 Low | Low | Business intelligence for planners |

---

# 📊 8. Scale Scenarios

## 8.1 Per-User Scale (Single Wedding)

| Guest Count | Dashboard | RSVP | Email | WhatsApp | AI Seating | Check-In |
|------------|-----------|------|-------|----------|-----------|---------|
| 50 | ✅ Smooth | ✅ Smooth | ✅ Smooth (~50s) | ✅ Smooth (~9 min) | ✅ Smooth (~3s) | ✅ Smooth |
| 200 | ✅ Smooth | ✅ Smooth | 🟡 Slow (~3 min) | 🟡 Slow (~36 min) | ✅ Smooth (~5s) | ✅ Smooth |
| 500 | 🟡 No pagination | ✅ Smooth | ⛔ Timeout | 🔴 Unreliable (~90 min) | 🟡 Slow (~12s) | ✅ Smooth |
| 1000+ | 🔴 Slow load | ✅ Smooth | ⛔ Fails | ⛔ Impractical (~3 hrs) | ⛔ May timeout | ✅ Smooth |

## 8.2 Platform Scale (Concurrent Weddings)

| Concurrent Weddings | Database | API | Auth | Overall |
|--------------------|----------|-----|------|---------|
| 10 | ✅ Stable | ✅ Stable | ✅ Stable | ✅ Production-ready |
| 50 | 🟡 Connection pressure | ✅ Auto-scales | ✅ Stable | 🟡 Needs PgBouncer |
| 200 | 🔴 Connection exhaustion | ✅ Auto-scales | ✅ Stable | 🔴 Needs pooling + caching |
| 1000+ | ⛔ Requires read replicas | ✅ Auto-scales | ✅ Stable | ⛔ Requires architectural changes |

---

# ⚖️ 9. Trade-Off Analysis

| Factor | Current State | Trade-Off |
|--------|--------------|-----------|
| **Development Speed** | ✅ Excellent — monolith, single deploy | Sacrifices microservice isolation for velocity |
| **Deployment Simplicity** | ✅ Excellent — Vercel zero-config | Ties platform to Vercel's pricing and limits |
| **WhatsApp Cost** | ✅ Free (Chrome Extension) | Sacrifices reliability and scalability for $0 cost |
| **Email Personalization** | ✅ Per-planner SMTP | Sacrifices deliverability monitoring for personalization |
| **Multi-Tenancy Security** | ✅ Strong (RLS) | Database-enforced isolation is robust but limits cross-tenant analytics |
| **AI Integration** | ✅ Powerful (Gemini + Tabbly) | Third-party dependency; no fallback if either goes down |
| **Real-Time Updates** | ✅ Supabase Realtime | Adds connection overhead per active planner dashboard |
| **Internationalization** | ✅ next-intl (EN + HI) | Adding more languages scales linearly with translation effort |

---

# 🧠 10. Final Verdict

### Is the system scalable?

**⚠️ Partially scalable.** The core web application (Next.js + Supabase + Clerk) has strong foundational scalability — serverless compute auto-scales, database has managed scaling paths, and multi-tenancy is properly isolated via RLS. These components can handle growth from MVP to early SaaS (hundreds of concurrent weddings).

However, **three critical subsystems are not scalable** in their current form:

1. **Email sending** — synchronous, sequential, no queue, subject to API timeouts
2. **WhatsApp Extension** — client-side, single-user, fragile DOM dependency, no observability
3. **AI operations** — synchronous, blocking, timeout-prone for large inputs

### Maximum Realistic Scale (Current Architecture)

| Dimension | Limit |
|-----------|-------|
| Guests per wedding | ~200 (comfortable), ~500 (strained) |
| Concurrent active weddings | ~50 (without PgBouncer), ~200 (with pooling) |
| Bulk email per session | ~30 emails before timeout risk |
| WhatsApp per session | ~200 messages reliably |
| AI seating plan | ~300 guests before timeout risk |

### What Must Change for Real Scalability

| Change | Unlocks |
|--------|---------|
| **Background job system** (Inngest/Trigger.dev) | Async email, AI operations; eliminates all timeouts |
| **Connection pooling** (Supabase PgBouncer) | 10× concurrent connection capacity |
| **Pagination** on all list endpoints | Handles 1000+ guest weddings comfortably |
| **Redis caching layer** | Reduces database load by ~50–80% for read-heavy pages |
| **Rate limiting middleware** | Prevents abuse, protects SMTP quotas and API limits |
| **WhatsApp failure reporting** | Gives planners visibility and retry capability |

---

# 🧠 Conclusion

WedSync's architecture is **well-designed for its current scale** — the choice of Next.js serverless, Supabase with RLS, and Clerk authentication provides a strong, modern foundation that many startups would envy at the MVP stage.

The **primary scalability risk is not the architecture itself** but the **absence of asynchronous processing infrastructure**. The moment any operation exceeds a serverless function's timeout (email blasts, AI generation, data exports), the system fails silently. Introducing a background job queue is the single highest-impact improvement.

The Chrome Extension is a **clever cost-optimization hack** that works well for small-to-medium weddings but should be positioned as a complementary tool, not the primary communication channel, as the platform scales.

**Bottom line:** With 3–4 targeted infrastructure improvements (background jobs, connection pooling, pagination, rate limiting), WedSync can scale from MVP to a production SaaS platform handling thousands of concurrent weddings — without requiring a fundamental architectural rewrite.

---

> **Report generated:** March 2026 · **Version:** 1.0.0
