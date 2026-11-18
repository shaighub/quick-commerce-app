# ADR-002: Express, Prisma, and PostgreSQL 16

- Status: Accepted
- Date: 2026-11-17
- Review refs: R22

## Context

The store needs a mainstream, supported stack with migrations, constraints, and a path to parameterized SQL for search.

## Decision

Node.js 20, Express, TypeScript strict, Prisma, and PostgreSQL 16. The API is layered: routes, controllers, services, repositories. Prisma Client is the data access tool. Repositories return domain data and take an explicit transaction client when a flow must be atomic.

Prisma ORM 7.10.1 is the version in this repo. Prisma 6's CLI depends on a vulnerable `deepmerge-ts`, and 7.10.1 is the patched release. The client is constructed with the `pg` driver adapter. `Prisma.TransactionClient` remains the transaction handle described in the design.

## Consequences

Migrations are committed. Partial indexes and the generated search column stay in SQL because Prisma cannot model all of them. Connection pooling is capped at 5 connections for a single API instance.
