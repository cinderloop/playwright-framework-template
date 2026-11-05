# 0011: Consumer-driven contract testing is out of scope

**Status:** Accepted

## Context

This framework checks API contracts in three ways, and Pact-style consumer-driven contract testing
is sometimes assumed to be the same thing. It is not.

| Technique         | Question it answers                                 | Who it needs                        |
| ----------------- | --------------------------------------------------- | ----------------------------------- |
| Schema validation | Does this response fit what our tests expect?       | Only the test suite                 |
| Spec drift check  | Does the running API match its published spec?      | The API and its spec                |
| Consumer contract | Will this provider change break these real clients? | A consumer team and a provider team |

In consumer-driven contract testing, each consumer records the requests it makes and the parts of the
responses it uses. Those contracts are shared, usually through a broker, and the provider's own build
replays them, so it finds out before release that a change would break a real client.

## Decision

Do not implement it here. Its value comes from the provider's pipeline running contracts written by
independent consumers. This repository owns neither side: Toolshop is a third-party practice app
whose build we cannot change, and a test framework is not a production consumer. A "contract" written
here would be replayed against nobody's release process, so it would only repeat the schema checks
with more machinery.

## Consequences

- No Pact dependency or broker to run.
- The drift check (ADR 0010) covers the part that is possible from outside: noticing when the API and
  its spec disagree. It cannot stop a breaking change from being released.
- A team that owns both a provider and its consumers should consider Pact. The Toolshop image
  contains a `pacts` directory, but nothing here uses it.
