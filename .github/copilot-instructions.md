# College ERP Project Guidelines

## Project

This repository is a college ERP web application for students, teachers, and admins.

## Technology

- Use Next.js, React, TypeScript, PostgreSQL, Prisma ORM, and Tailwind CSS.
- Follow the existing project configuration and scripts. Do not introduce a library unless it is necessary and justified.

## Architecture

- `User` is the authentication account and the source of identity and authorization.
- `Student` and `Teacher` are college-specific entities. A `User` may be related one-to-one with either entity as appropriate.
- The system is role-based with `STUDENT`, `TEACHER`, and `ADMIN` roles. `ADMIN` has the highest access level.
- Enforce authentication and authorization on the backend. Do not rely on hiding controls or routes in the frontend.
- Keep authentication and authorization logic centered on `User` and reuse the existing authentication utilities and API patterns.

## Database

- PostgreSQL is the database and Prisma is the ORM.
- Use explicit foreign-key relationships and keep the schema normalized where practical.
- Avoid duplicating data or adding entities without a clear purpose.
- The database is in development, so schema changes may be rebuilt when appropriate.
- Before changing the database, explain the required models, fields, relationships, and migration or rebuild impact.

## Development Workflow

- Before implementing a feature, inspect the existing code, Prisma schema, generated client usage, authentication logic, and nearby components.
- Reuse existing components, models, utilities, and patterns. Do not rewrite working code unnecessarily.
- Keep changes focused and consistent with the existing architecture.
- Validate changes with the narrowest relevant check, then run the project lint or build checks when appropriate.
