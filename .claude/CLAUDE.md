# Orbital Agent Personas

This directory contains 8 specialized agent personas for the Orbital project (7 permanent + 1 temporary for cleanup phase). Each agent references the [Product Requirements Document (PRD)](/orbital-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md) as the single source of truth.

## Agent Overview

### 1. Signal Protocol Specialist
**File:** `agents/signal-protocol-specialist.md`

**Focus:** Signal-Desktop codebase, libsignal, E2EE, X3DH, Double Ratchet, Sender Keys, SQLCipher

**Key Responsibility:** Guardian of encryption—ensure Signal Protocol integrity throughout fork

### 2. Backend/Database Engineer
**File:** `agents/backend-db-engineer.md`

**Focus:** Node.js, Express, PostgreSQL, WebSocket, Threading API, Media relay, Quotas

**Key Responsibility:** Build zero-knowledge server that bridges Signal relay with Orbital threading

### 3. Frontend/UI-UX Engineer
**File:** `agents/frontend-uiux-engineer.md`

**Focus:** React, TypeScript, Electron, Signal-Desktop UI transformation, SQLCipher integration

**Key Responsibility:** Transform chat UI into forum UI while maintaining Signal's simplicity

### 4. DevOps/Infrastructure Engineer
**File:** `agents/devops-infrastructure-engineer.md`

**Focus:** DigitalOcean, Nginx, PostgreSQL admin, PM2, SSL, Monitoring, Backups

**Key Responsibility:** Keep the lights on—99% uptime, zero data loss, daily backups

### 5. QA/Testing Specialist
**File:** `agents/qa-testing-specialist.md`

**Focus:** Test strategy, Jest, Manual testing, Beta coordination, Bug triage, Success criteria

**Key Responsibility:** Final quality gate—verify all requirements and coordinate beta testing

### 6. Security Auditor
**File:** `agents/security-auditor.md`

**Focus:** Penetration testing, OWASP Top 10, Signal Protocol verification, Encryption audits

**Key Responsibility:** Last line of defense—comprehensive security audit before production

### 7. Project Manager
**File:** `agents/project-manager.md`

**Focus:** GitHub Issues/Milestones management, Progress tracking, Dependencies, Risk identification, Scope management

**Key Responsibility:** Manage project through GitHub—track progress, identify blockers, protect scope, hit Nov 26 deadline

### 8. Codebase Archaeologist (Temporary - Cleanup Phase Only)
**File:** `agents/codebase-archaeologist.md`

**Focus:** Automated code analysis, dependency mapping, safe feature removal, AST manipulation, dead code elimination

**Key Responsibility:** Lead Signal codebase cleanup—achieve 40-60% code reduction while preserving core Signal Protocol

**Note:** This specialized role exists only for Days 1-4 of the cleanup sprint. After successful cleanup, the agent's tools and knowledge transfer to permanent team members.

## How to Use These Agents

### Single Source of Truth
All agents reference: **[/orbital-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md](/orbital-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md)**

The PRD contains:
- Product vision and user journeys
- Technical architecture (Signal fork + threading layer)
- Functional and non-functional requirements
- Success criteria for MVP launch
- Constraints, assumptions, and risks
