# ADR-011: Vercel and Render in Singapore on free tiers for dev and preview

- Status: Accepted
- Date: 2026-11-17
- Review refs: R07, R16, R17, R26

## Context

The demo should run at no cost and stay close to shoppers in India. Production-grade hosting (no spin-down, backups, a commercial Vercel plan) is a later decision.

## Decision

The web app is a static Vite build on Vercel. The API is a Docker service on Render in Singapore. PostgreSQL 16 is Render Postgres in the same region. Dev and preview use the free tiers and seed or test data only. Paid capacity is decided at checkpoint 5.

Accepted risks until then: the free web service spins down after idle, the free database expires and has no backups, and there is a single instance.

## Consequences

Deploys are not part of milestone 1. When they are, `prisma migrate deploy` is the pre-deploy command, and the process drains for up to 10 seconds on SIGTERM before closing the pool. `vercel.json` must be updated with the real Render hostname.
