# Contributing to Diorama

Thank you for helping improve Diorama. This document describes how we work and what we look for in contributions.

## Code of conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report concerns to the maintainers via GitHub or the contact listed in the conduct document.

## Before you start

1. **Open an issue** (or comment on an existing one) for non-trivial changes so direction and scope are agreed early.
2. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and `AGENTS.md` at the repo root for architectural intent.
3. Prefer **small, focused PRs** over large mixed changes.

## Development setup

```bash
npm install
npm run dev          # web app
npm run test         # all package tests
npm run typecheck    # TypeScript across workspaces
npm run lint         # web ESLint
```

New behavior should include **tests** where it applies:

- **Reducer / command semantics** — add or extend tests in `packages/core` (and related packages).
- **Serialization or export** — add roundtrip or snapshot tests in `packages/schema` / `packages/export-r3f` as appropriate.
- **UI regressions** — prefer component or store tests in `apps/web` when the change is user-visible.

If coverage for an important edge case is intentionally deferred, say so in the PR description.

## Architectural rules (summary)

- **Do not mutate scene state** from UI code. Dispatch commands through the existing store/reducer path.
- **Schema and commands are authoritative**; the viewport interprets state—it does not own it.
- **TypeScript** for new code; **Zod** for contracts that cross boundaries.
- **Pure reducers** for scene updates; use Zustand (or similar) only for app/view concerns, not as a second scene graph.

## Pull requests

- Use the [pull request template](.github/pull_request_template.md) (GitHub fills it automatically).
- Describe **what** changed and **why**, with links to issues when relevant.
- Ensure `npm run test` and `npm run typecheck` pass locally before requesting review.
- Keep unrelated formatting or refactors out of feature PRs.

## Good first issues

See [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) for curated starter tasks.

## Questions

Use GitHub **Discussions** if enabled, or open an issue labeled **question** so answers stay searchable for others.
