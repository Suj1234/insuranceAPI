# Product Brief — Insuretech Data Platform

## What it is
A **B2B API documentation portal** for the Insuretech Data Platform — a structured environmental risk data service built for Indian insurance underwriting pipelines. Access is gated behind a login; users receive an API key they use in the integrated Tryout panel.

## Who uses it
**Primary:** Backend engineers integrating risk APIs into insurance core systems.  
**Secondary:** Actuaries evaluating data coverage and quality before procurement.  
**Never:** Consumers, general developers, startup founders.

Users open this portal with a task in mind — they are reading docs or testing an endpoint. They are not browsing. They are not being marketed to.

## What it does
Four REST API groups, all read-only GET:

| API | Data source | Coverage |
|-----|------------|---------|
| District Risk | CPCB, CAMS, SEDAC, ERA5, EM-DAT, NFHS-5 | Air quality, heat stress, disasters, population health burden |
| AQI History | CPCB / CAMS | Monthly pollutant time-series up to 5 years |
| Water Quality — State | CGWB | Ground water contamination by state |
| Water Quality — Hotspots | CGWB | Contamination hotspot districts |

## Core user flows
1. **Login** → land on Abstract page
2. **Sidebar** → pick an API endpoint
3. **Documentation tab** → read params schema + response schema + code examples
4. **Tryout tab** → fill form → SEND → inspect response body / data preview
5. Copy code snippet (cURL / JS / Python / Node) → integrate

## Product personality
**Data credible. Not startup-playful.**  
Think: the precision of a financial terminal, the clarity of Stripe's API docs.  
Users trust this product with underwriting decisions. Every design choice should reinforce that trust — through density, precision, and restraint — not through decoration.

## Anti-references (what this is NOT)
- Not a SaaS marketing site (no hero sections, no feature cards, no gradient CTAs)
- Not a consumer product (no onboarding flows, no celebratory empty states)
- Not a developer blog (no large typography, no article-style layout)
- Not a dashboard (no charts, KPI cards, or metric widgets in the docs portal)
