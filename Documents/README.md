# Samantha App Project Documents

This directory is the management and operational record for Samantha App releases.

## Current Release

**Version:** 2.4.0

**Release date:** 2026-07-13

**Outcome:** A local-first Samantha mobile companion that converges with PRISM desktop through a durable, versioned synchronization contract.

## Documents

| Document | Purpose |
|---|---|
| [User Manual](USER_MANUAL.md) | User workflows, status meanings, offline behavior, and recovery |
| [Backlog](BACKLOG.md) | Prioritized outstanding product and engineering work |
| [Project History](PROJECT_HISTORY.md) | Versioned record of released outcomes |
| [Architecture](SAMANTHA_APP_ARCHITECTURE.md) | Current system boundaries, contracts, risks, and operations |
| [2.4.0 Sprint Archive](Sprints/archive/2.4.0-reliable-prism-sync.md) | Closed sprint scope, evidence, and carry-forward work |

## Release Discipline

Every release must:

1. choose a semantic version appropriate to the delivered outcome;
2. update `package.json`, `package-lock.json`, the app-visible version, and Android `versionName`/`versionCode`;
3. update the user manual, backlog, project history, architecture, and sprint archive;
4. run the verification contract appropriate to the changed behavior;
5. stage only the coherent release files and exclude local/generated material;
6. record the commit hash and deployment proof after publication.

The focused implementation notes in `../docs/` support this management layer but do not replace it.
