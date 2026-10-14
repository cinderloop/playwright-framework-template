# Architecture decision records

Short records of the decisions that shape this framework: the context, what was decided and what
follows from it. A new decision gets the next number. A reversed decision is marked
**Superseded** with a link to its replacement, never deleted.

| ADR                                               | Decision                                      |
| ------------------------------------------------- | --------------------------------------------- |
| [0001](0001-fixtures-over-inheritance.md)         | Fixtures over inheritance                     |
| [0002](0002-api-based-auth-setup.md)              | Log in through the API in a setup project     |
| [0003](0003-zod-for-schema-validation.md)         | Zod for config and response validation        |
| [0004](0004-docker-based-visual-baselines.md)     | Visual baselines only in the Playwright image |
| [0005](0005-toolshop-in-ci-via-docker-compose.md) | Toolshop in CI via Docker Compose             |
| [0006](0006-renovate-for-dependency-updates.md)   | Renovate rather than Dependabot               |
