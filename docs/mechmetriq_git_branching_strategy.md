---
title: "MECHmetrIQ — Git Branching Strategy & Workflow Standards"
document_type: "Engineering Workflow Specification"
version: "2.1.0"
date: "2026-11-02"
author: "Lakshman Shrinivasan"
industrial_standards:
  - "Conventional Commits v1.0.0"
  - "Semantic Versioning (SemVer 2.0.0)"
  - "GitHub Flow / Protected Trunk Workflow"
status: "Active Team Policy"
---

# MECHmetrIQ — Git Branching Strategy

> **For:** The MECHmetrIQ development team
> **Goal:** Never break the live website. Test everything before it goes to customers.

---

## 1. Branch Hierarchy — The Big Picture

```mermaid
graph TD
    subgraph "🔴 PRODUCTION (Live Website)"
        MAIN["<b>main</b><br/>━━━━━━━━━━━━━━━<br/>🌐 mechmetriq.com<br/>Only tested, approved code<br/>🔒 Protected — no direct pushes"]
    end

    subgraph "🟡 TESTING (Sandbox)"
        STAGING["<b>staging</b><br/>━━━━━━━━━━━━━━━<br/>🧪 staging.mechmetriq.com<br/>Team tests here before going live<br/>🔒 Protected — merge via PR only"]
    end

    subgraph "🟢 DEVELOPMENT (Developer Machines)"
        F1["<b>feature/3d-viewer</b><br/>New feature work"]
        F2["<b>feature/sheet-metal-quoting</b><br/>New feature work"]
        F3["<b>feature/dfm-feedback</b><br/>New feature work"]
        FIX1["<b>fix/turning-routing-bug</b><br/>Bug fix"]
        FIX2["<b>fix/duplicate-features</b><br/>Bug fix"]
    end

    subgraph "🔥 EMERGENCY"
        HOT["<b>hotfix/payment-crash</b><br/>Critical production fix"]
    end

    F1 -->|"Pull Request<br/>+ Code Review<br/>+ Auto Tests"| STAGING
    F2 -->|"Pull Request"| STAGING
    F3 -->|"Pull Request"| STAGING
    FIX1 -->|"Pull Request"| STAGING
    FIX2 -->|"Pull Request"| STAGING

    STAGING -->|"Pull Request<br/>+ Final QA<br/>+ Team Approval"| MAIN

    HOT -->|"Emergency PR<br/>(skip staging)"| MAIN
    HOT -.->|"Back-merge"| STAGING

    style MAIN fill:#dc2626,stroke:#991b1b,color:#fff
    style STAGING fill:#eab308,stroke:#a16207,color:#000
    style F1 fill:#22c55e,stroke:#15803d,color:#fff
    style F2 fill:#22c55e,stroke:#15803d,color:#fff
    style F3 fill:#22c55e,stroke:#15803d,color:#fff
    style FIX1 fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style FIX2 fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style HOT fill:#f97316,stroke:#c2410c,color:#fff
```

---

## 2. How Code Flows From Developer → Live Website

```mermaid
sequenceDiagram
    participant DEV as 👨‍💻 Developer
    participant BRANCH as 🌿 Feature Branch
    participant PR1 as 📋 PR to Staging
    participant STAGING as 🟡 Staging
    participant PR2 as 📋 PR to Main
    participant MAIN as 🔴 Main (Live)
    participant USERS as 👥 Customers

    DEV->>BRANCH: 1. Create branch from staging
    DEV->>BRANCH: 2. Write code + commit
    DEV->>PR1: 3. Open Pull Request → staging
    
    Note over PR1: ✅ Auto-tests run<br/>✅ Preview URL created<br/>✅ Teammate reviews code
    
    PR1->>STAGING: 4. Merge to staging
    
    Note over STAGING: 🧪 Team tests on<br/>staging.mechmetriq.com<br/>for 1-2 days

    STAGING->>PR2: 5. Open Pull Request → main
    
    Note over PR2: ✅ Final QA checklist<br/>✅ Team lead approves

    PR2->>MAIN: 6. Merge to main
    
    Note over MAIN: 🚀 Auto-deploys to<br/>mechmetriq.com

    MAIN->>USERS: 7. Customers see the update
```

---

## 3. All Branch Types Explained

### Branch Naming Convention

```
TYPE / short-description

Examples:
  feature/3d-viewer
  feature/sheet-metal-quoting
  feature/what-if-simulator
  feature/enterprise-api
  fix/turning-routing-bug
  fix/duplicate-cylinder-merge
  fix/cold-start-timeout
  hotfix/payment-gateway-crash
  chore/update-dependencies
  docs/api-documentation
```

| Branch Type | Prefix | Created From | Merges Into | Purpose | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Main** | `main` | — | — | Live production website. Only tested code. | `main` |
| **Staging** | `staging` | `main` | `main` | Pre-production testing. Team QA happens here. | `staging` |
| **Feature** | `feature/` | `staging` | `staging` | New functionality (3D viewer, DFM, etc.) | `feature/dfm-feedback` |
| **Bug Fix** | `fix/` | `staging` | `staging` | Fix a known bug that's not urgent | `fix/turning-routing-bug` |
| **Hotfix** | `hotfix/` | `main` | `main` + `staging` | Emergency fix for live site (site is crashing!) | `hotfix/payment-crash` |
| **Chore** | `chore/` | `staging` | `staging` | Non-feature work (update packages, refactor) | `chore/update-cadquery` |
| **Docs** | `docs/` | `staging` | `staging` | Documentation only | `docs/api-reference` |

### Industry Standards: Commit Messages & Versioning

#### 1. Conventional Commits (v1.0.0 Standard)
Every git commit message should follow the format: `type(scope): description`
* `feat`: A new feature (e.g., `feat(smartquote): add cylindrical face coaxiality check`)
* `fix`: A bug fix (e.g., `fix(parser): resolve bounding box rotation mismatch`)
* `perf`: Performance improvement (e.g., `perf(cache): cache raw material rates in Redis`)
* `docs`: Documentation updates (e.g., `docs(capp): document turning setup calculations`)
* `chore`: Tooling / dependency updates (e.g., `chore(deps): update cadquery to 2.8`)

#### 2. Semantic Versioning (SemVer 2.0.0 Standard)
Release tags follow `vMAJOR.MINOR.PATCH` (e.g., `v1.2.4`):
* **MAJOR (`+1.0.0`):** Breaking changes or architectural shifts (e.g. migrating synchronous parser to async queue).
* **MINOR (`0.+1.0`):** New backwards-compatible features (e.g. adding 3D web viewer or DFM check).
* **PATCH (`0.0.+1`):** Backwards-compatible bug fixes and small optimizations.

---

## 4. Branch Protection Rules

Set these in **GitHub → Settings → Branches → Branch Protection Rules:**

### `main` branch (Production)
```
✅ Require pull request before merging
✅ Require at least 1 approval
✅ Require status checks to pass (tests must be green)
✅ Require branches to be up to date before merging
✅ Do NOT allow force pushes
✅ Do NOT allow deletions
```

### `staging` branch (Testing)
```
✅ Require pull request before merging
✅ Require status checks to pass (tests must be green)
☐ Approvals optional (developer can self-merge for speed)
✅ Do NOT allow force pushes
✅ Do NOT allow deletions
```

### All other branches (feature/fix/hotfix)
```
☐ No restrictions — developers can push freely
☐ Auto-deleted after PR is merged (keeps repo clean)
```

---

## 5. CI/CD Pipeline — What Happens Automatically

```mermaid
flowchart LR
    subgraph "On Every Push to Any Branch"
        A["🔍 Lint Code<br/>(check formatting)"] --> B["🧪 Run Tests<br/>(unit + integration)"]
        B --> C["🏗️ Build Check<br/>(does it compile?)"]
    end

    subgraph "On PR to staging"
        D["All above ✅"] --> E["🌐 Deploy Preview<br/>(unique sandbox URL)"]
        E --> F["💬 Bot comments<br/>preview URL on PR"]
    end

    subgraph "On Merge to staging"
        G["All above ✅"] --> H["🟡 Deploy to<br/>staging.mechmetriq.com"]
    end

    subgraph "On Merge to main"
        I["All above ✅"] --> J["🔴 Deploy to<br/>mechmetriq.com"]
        J --> K["📊 Sentry release<br/>tracking"]
    end

    style A fill:#6366f1,color:#fff
    style B fill:#6366f1,color:#fff
    style C fill:#6366f1,color:#fff
    style E fill:#eab308,color:#000
    style H fill:#eab308,color:#000
    style J fill:#dc2626,color:#fff
    style K fill:#dc2626,color:#fff
```

---

## 6. Real-World Example: Adding the 3D Viewer

```mermaid
gitgraph
    commit id: "v1.0 — current live site"
    branch staging
    checkout staging
    commit id: "staging synced with main"
    
    branch feature/3d-viewer
    checkout feature/3d-viewer
    commit id: "install three.js + react-three-fiber"
    commit id: "add glTF export to CAD worker"
    commit id: "build CadViewer3D component"
    commit id: "integrate viewer into quote page"
    commit id: "fix lighting and camera angle"
    
    checkout staging
    merge feature/3d-viewer id: "PR #14 merged ✅" type: HIGHLIGHT
    commit id: "team tests 3D viewer for 2 days"
    
    checkout main
    merge staging id: "PR #15 → PRODUCTION 🚀" type: HIGHLIGHT
    commit id: "v1.1 — 3D viewer live!"
```

---

## 7. Emergency Hotfix Flow

When the live site is broken and customers are affected:

```mermaid
flowchart TD
    A["🚨 ALERT: Payment page<br/>crashing on production!"] --> B["Create branch from <b>main</b><br/><code>hotfix/payment-crash</code>"]
    B --> C["Fix the bug<br/>(minimal change only)"]
    C --> D["Open PR directly to <b>main</b><br/>(skip staging)"]
    D --> E{"Tests pass?"}
    E -->|Yes| F["Team lead approves<br/>+ merge immediately"]
    E -->|No| C
    F --> G["🔴 Auto-deploys to<br/>mechmetriq.com"]
    G --> H["Back-merge hotfix<br/>into <b>staging</b>"]
    H --> I["✅ Crisis resolved"]

    style A fill:#dc2626,color:#fff
    style G fill:#dc2626,color:#fff
    style I fill:#22c55e,color:#fff
```

> **Rule:** Hotfixes should be **tiny, surgical changes**. Don't use hotfixes to sneak in new features. Fix only the exact bug.

---

## 8. Developer Daily Workflow — Step by Step

### Starting New Work

```bash
# 1. Make sure you have the latest staging code
git checkout staging
git pull origin staging

# 2. Create your feature branch
git checkout -b feature/dfm-feedback

# 3. Do your work... write code, test locally
#    (use docker compose up to run everything locally)

# 4. Commit your changes (small, meaningful commits)
git add .
git commit -m "Add thin-wall DFM check with material-specific thresholds"

# 5. Push your branch to GitHub
git push origin feature/dfm-feedback

# 6. Go to GitHub → Open Pull Request → target: staging
#    → Fill in the description: what changed, why, how to test
#    → Wait for auto-tests to pass ✅
#    → Ask teammate to review (or self-merge if branch rules allow)
```

### After Your PR Is Merged to Staging

```bash
# 7. Test your changes on staging.mechmetriq.com
#    - Upload a test STEP file
#    - Check that DFM warnings appear
#    - Check that nothing else broke

# 8. When satisfied, open PR: staging → main
#    → Team lead reviews and approves
#    → Merge → automatically deploys to production 🚀

# 9. Delete your feature branch (GitHub does this automatically)
git checkout staging
git pull origin staging
git branch -d feature/dfm-feedback
```

---

## 9. Summary — The 4 Branches You Always Have

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🔴 main ──────────── The live website                │
│      │                  (customers use this)            │
│      │                                                  │
│   🟡 staging ────────── The testing website             │
│      │                  (team tests here)               │
│      │                                                  │
│      ├── 🟢 feature/* ── New features                   │
│      ├── 🔵 fix/* ────── Bug fixes                      │
│      └── ⚪ chore/* ──── Maintenance                    │
│                                                         │
│   🟠 hotfix/* ────────── Emergency fixes                │
│      (branches from main, merges to main + staging)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Question | Answer |
| :--- | :--- |
| **How many permanent branches?** | 2 — `main` and `staging` |
| **How many temporary branches?** | As many as needed — one per task, deleted after merge |
| **Who can push to `main`?** | Nobody directly. Only via approved PR from `staging`. |
| **Who can push to `staging`?** | Nobody directly. Only via PR from feature/fix branches. |
| **How long do feature branches live?** | Days to weeks. Delete after merge. |
| **What if I need to work on 2 features at once?** | Create 2 separate branches. Keep them independent. |

---

> **Golden Rule:** Code flows in one direction:
> `feature branch` → `staging` → `main` → `customers`
>
> Never skip a step. Never push directly to `main` or `staging`.
