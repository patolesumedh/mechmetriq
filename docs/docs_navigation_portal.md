# MECHmetrIQ — Master Documentation & Metadata Navigation Hub

> **System Overview:** Complete technical, architectural, operational, and process planning specifications for MECHmetrIQ CAD-to-Quote Platform.  
> **Metadata Standard:** YAML Frontmatter + Dublin Core / ISO 10303 / NIST SP 800-53 / ISO 27001 Alignments.  
> **Last Verified:** 2026-11-02

---

## 📚 Document Registry & Metadata Directory

| Document | Category | Industrial Standards | Key Summary | Direct Link |
| :--- | :--- | :--- | :--- | :--- |
| **Turning CAD Ecosystem & Algorithm Evolution Plan** | Algorithm & CAD Architecture | ISO 10303 (AP242), ISO 286, ISO 2768, ISO 21920:2021 | Analysis of the Turning CAD Ecosystem Blueprint PDF: Profile-first 2D math, semantic reference descriptors, field-level confidence AI intent, 7-layer validation, and closed-loop STEP round-trip verification. | [turning_cad_algorithm_improvement_plan.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/turning_cad_algorithm_improvement_plan.md) |
| **Advanced Turning Process Planning (CAPP) & AI Architecture** | Algorithm & CAD | ISO 10303 (AP242), ISO 286, ISO 2768, ISO 21920:2021, ISO 1832, ASME Y14.5 | 17-point turning process plan, cylindrical coordinate profile extraction, stock optimization, chuck grip sizing, dynamic workpiece stiffness, and AI CAD / AI DFM review. | [algorithm_process_planning_plan.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/algorithm_process_planning_plan.md) |
| **Architecture Review & Production Redesign** | Cloud Architecture | SOC 2 Type II, ISO/IEC 27001:2022, NIST SP 800-53, DPDP Act 2023, GDPR, FIPS 140-3 | As-is MVP audit vs. AWS/GCP production architecture, CAD file lifecycle security, defense-in-depth, async queue, and 1,000 concurrent user scaling. | [Mechmetriq_Architecture_review.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/Mechmetriq_Architecture_review.md) |
| **Budget-Optimized Production Architecture** | Cloud & Cost | DPDP Act 2023, GDPR, FIPS 197, CIS GCP Foundations Benchmark | Production-grade security and auto-scaling on GCP Cloud Run + Supabase Pro + Cloudflare Free at ₹12,000–₹20,000/month ($150–$250). | [mechmetriq_budget_architecture.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/mechmetriq_budget_architecture.md) |
| **Budget Architecture Proposal (Executive Copy)** | Cloud & Cost | DPDP Act 2023, GDPR, FIPS 197, CIS GCP Foundations Benchmark | Identical executive proposal companion detailing pay-per-use, scale-to-zero serverless architecture, and smooth upgrade triggers. | [Mechmetriq_Budget_Architecture_Proposal.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/Mechmetriq_Budget_Architecture_Proposal.md) |
| **Production Deployment Blueprint (Zero-Cost Supabase Tier)** | DevOps & Infrastructure | CIS GCP 5.1 (Public Access Prevention), CIS Docker 4.1, RFC 8446 (TLS 1.3) | Complete 7-day deployment blueprint without Supabase Pro ($25/mo). Operates at ₹83–₹2,000/mo ($1–$24/mo) with automated keep-alive, GCS offload, and nightly backups. | [mechmetriq_deployment_blueprint_supabase_free.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/mechmetriq_deployment_blueprint_supabase_free.md) |
| **Production Deployment Blueprint (Supabase Pro Edition)** | DevOps & Infrastructure | CIS GCP 5.1 (Public Access Prevention), CIS Docker 4.1, RFC 8446 (TLS 1.3) | Day-by-day 7-day deployment manual: GCP Cloud Run, Cloudflare WAF, GCS bucket security, CI/CD sandbox preview environments, and local Docker compose. | [mechmetriq_deployment_blueprint.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/mechmetriq_deployment_blueprint.md) |
| **Git Branching Strategy & Workflow Standards** | Engineering Process | Conventional Commits v1.0.0, Semantic Versioning 2.0.0 (SemVer), GitHub Flow | Production code safety: protected `main` & `staging` branches, automated PR preview environments, hotfix protocols, and commit conventions. | [mechmetriq_git_branching_strategy.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/mechmetriq_git_branching_strategy.md) |
| **Plain English Tech Glossary for Founders** | Education & Onboarding | ISO 10303, ASME Y14.5, ISO 21920, NIST SP 800-145 | Non-tech founder's guide translating vibe coding, containers, pre-signed URLs, RLS, DFM, GD&T, and CAPP using clear restaurant and factory analogies. | [mechmetriq_tech_terms_laymans_guide.md](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/mechmetriq_tech_terms_laymans_guide.md) |

---

## 🏷️ Standardized YAML Frontmatter Metadata Structure

Every `.md` file now includes standardized header metadata compatible with Markdown parsers, documentation generators (Docusaurus, VitePress, Nextra), and IDE viewers:

```yaml
---
title: "Document Title"
document_type: "Specification | Architecture | Blueprint | Glossary"
version: "2.1.0"
date: "2026-11-02"
author: "Author / Reviewer Name"
target_platform: "Cloud & Runtime Target"
industrial_standards:
  - "Standard Name 1 (e.g. ISO 10303 AP242)"
  - "Standard Name 2 (e.g. SOC 2 Type II / DPDP Act 2023)"
status: "Approved / Execution Ready / Living Document"
---
```

---

## 🔍 How to View These Documents

1. **In Antigravity IDE Artifact Viewer:**
   * Open the Artifacts panel to inspect any of the documents formatted with interactive code blocks, tables, and Mermaid flowcharts.
2. **In Local Code Editor:**
   * Navigate to the [`docs/`](file:///c:/Users/shrin/Documents/mechmetriq-main/docs/) directory in your repository.
3. **In Web & Static Site Generators:**
   * The standardized YAML frontmatter automatically populates search tags, titles, authors, and categorizations across static doc platforms.

