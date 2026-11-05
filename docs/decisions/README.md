# Architecture decision records

Short records of the decisions that shape this framework: the context, what was decided and what
follows from it. A new decision gets the next number. A reversed decision is marked
**Superseded** with a link to its replacement, never deleted.

| ADR                                                 | Decision                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| [0001](0001-fixtures-over-inheritance.md)           | Fixtures over inheritance                                      |
| [0002](0002-api-based-auth-setup.md)                | Log in through the API in a setup project (superseded by 0015) |
| [0003](0003-zod-for-schema-validation.md)           | Zod for config and response validation                         |
| [0004](0004-docker-based-visual-baselines.md)       | Visual baselines only in the Playwright image                  |
| [0005](0005-toolshop-in-ci-via-docker-compose.md)   | Toolshop in CI via Docker Compose                              |
| [0006](0006-renovate-for-dependency-updates.md)     | Renovate rather than Dependabot                                |
| [0007](0007-vitest-for-core-unit-tests.md)          | Vitest for pure core functions                                 |
| [0008](0008-authorization-matrix.md)                | Authorization rules as a data-driven matrix                    |
| [0009](0009-403-or-404-for-cross-user-access.md)    | Accept 403 or 404 for cross-user access                        |
| [0010](0010-contract-drift-check.md)                | Compare live responses with the spec                           |
| [0011](0011-no-consumer-driven-contract-testing.md) | Consumer-driven contract testing is out of scope               |
| [0012](0012-fast-check-for-property-tests.md)       | fast-check for property-based tests                            |
| [0013](0013-background-worker-in-the-stack.md)      | A background worker in the Toolshop stack                      |
| [0014](0014-advanced-api-layer-in-this-repo.md)     | Keep the advanced API layer in this repository                 |
| [0015](0015-sign-in-per-test.md)                    | Sign in per test                                               |
