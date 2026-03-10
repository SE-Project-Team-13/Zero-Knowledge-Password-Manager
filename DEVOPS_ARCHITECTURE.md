## Comprehensive DevOps Strategy Document
| Document Metadata | |
|-------------------|-----------------|
| **Project** | Zenith Vault (Password Manager) |
| **Version** | 1.0.0 |
| **Date** | March 10, 2026 |
| **Classification** | Professional |
| **Author** | DevOps Architecture Team |
| **GitHub** | https://github.com/SE-Project-Team-13/zenith-vault |

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Project Component Inventory](#2-project-component-inventory)
3. [CI/CD Architecture](#3-cicd-architecture)
4. [Deployment Topology](#4-deployment-topology)
5. [Environment Strategy](#5-environment-strategy)

---

### 1. Executive Summary
#### 1.1 Project Overview
Zenith Vault is a high-security zero-knowledge password management system consisting of:
- **Frontend SPA**: Next.js + React 19 + Tailwind CSS application
- **Backend API Service**: Node.js + Express.js REST API
- **Mobile Application**: React Native mobile app
- **Extensions & Crypto**: Browser extension and dedicated crypto-engine
- **Database Layer**: MongoDB

#### 1.2 DevOps Objectives
| Objective | Description | Priority |
|-----------|-------------|----------|
| **Automation** | Automate build, test, and deployment pipelines through GitHub Actions. | Critical |
| **Quality Assurance** | Enforce formatting, linting, and testing before any deployment. | Critical |
| **Reliability** | Ensure consistent deployments across all workspace packages. | High |

---

### 2. Project Component Inventory
| Component ID | Component Name | Type | Source Location | Deployable |
|--------------|----------------|------|-----------------|------------|
| **FE-001** | Frontend Dashboard | Application | `frontend/` | Yes |
| **BE-001** | Backend API | Application | `backend/` | Yes |
| **MOB-001**| Mobile App | Application | `mobile/` | Yes |
| **EXT-001**| Browser Extension| Application | `frontend/extension/` | No (Store) |
| **CRYP-001**| Crypto Engine | Library | `frontend/crypto-engine/`| No (Dep) |

---

### 3. CI/CD Architecture
#### 3.1 Pipeline Overview
The CI/CD pipeline is orchestrated via GitHub Actions triggered on `main` and specific contributor branches (`karthik`, `karthik2`).

```
Developer → Push/PR → CI Checks (Test & Lint) → Deploy Hooks → Render
```

#### 3.2 CI Pipeline Stages
The CI process defined in `.github/workflows/ci.yml` consists of:

1. **test-crypto**: Installs dependencies and runs unit tests for the crypto engine.
2. **test-backend**: Runs integration and unit tests for the backend via Jest and mongodb-memory-server.
3. **test-frontend**: Builds the crypto engine and runs frontend unit tests.
4. **code-quality**: Executes ESLint on both frontend and backend directories.

#### 3.3 CD Deployments
Deployments are fully automated upon successful completion of the CI jobs (tests and code quality):
- **Backend Deployment**: Triggers a webhook (`RENDER_DEPLOY_HOOK_BACKEND`) to deploy the Node.js API to Render.
- **Frontend Deployment**: Triggers a webhook (`RENDER_DEPLOY_HOOK_FRONTEND`) to deploy the Next.js application to Render.

---

### 4. Deployment Topology
Both primary services are deployed using Render (`render.yaml`).

| Component | Platform | Environment | Command |
|-----------|----------|-------------|---------|
| Frontend | Render (Web) | Node / Production | `npm run build -w frontend` → `npm start -w frontend` |
| Backend | Render (Web) | Node / Production | `npm run build -w backend` → `npm start -w backend` |
| Database | MongoDB Atlas | Production | Native Connection |

---

### 5. Environment Strategy
| Variable | Local/Dev | Production (Render) | Sensitive |
|----------|-----------|---------------------|-----------|
| `NODE_ENV` | development | production | No |
| `MONGODB_URI`| mongodb://localhost:27017 | Atlas Connection String | **Yes** |
| `JWT_SECRET` | local-secret | Production secure key | **Yes** |
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | Dynamic from Render Backend | No |
| `FRONTEND_URL` | http://localhost:3000 | Dynamic from Render Frontend | No |
