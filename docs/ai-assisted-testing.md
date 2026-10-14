# AI-assisted testing

Playwright 1.56+ ships three test agents: **planner**, **generator** and **healer**. They run
through an MCP server that is bundled with `@playwright/test`. This repository uses Playwright
1.64.0, so the agents are supported. This page records how they were set up, exactly how they were
used to add contact form coverage, what they produced, and what human review changed or rejected.

**Summary:** the agents explored the app quickly and produced a useful test plan. They were wrong
about the app's behaviour three times. The generated code did not follow the framework's standards
and needed a rewrite. None of their output was committed without review, and the healer's fix was
rejected.

## Setup

The setup follows the official
[Playwright test agents docs](https://playwright.dev/docs/test-agents):

```bash
npx playwright init-agents --loop=claude --project=chromium
```

This generated:

| File                                  | Purpose                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `.claude/agents/playwright-test-*.md` | Claude Code subagent definitions for planner, generator and healer (unchanged)    |
| `.mcp.json`                           | Registers the `playwright-test` MCP server (`npx playwright run-test-mcp-server`) |
| `specs/README.md`                     | Directory for test plans                                                          |
| `tests/seed.spec.ts`                  | Seed test; replaced, see below                                                    |

The agents start every session by running a **seed test** to put a page in a known state. The
generated seed used raw `@playwright/test` and lived in `tests/`, where every browser project would
run it as an empty test. Changes made during review:

- The seed moved to `tests/agents/seed.spec.ts`. It uses the app fixtures, opens the product
  listing and asserts that a product card is visible.
- It runs only in an **`agents` project**, which `playwright.config.ts` defines only when
  `PW_AGENTS=1`. `.mcp.json` sets that variable for the MCP server, so normal runs, CI and
  `--list` never see the project.
- Browser projects ignore `tests/agents/`.
- `.claude/agents/` and `specs/` are excluded from Prettier, so a future `init-agents` run diffs
  cleanly against upstream.
- `.playwright-mcp/` (the agents' console logs and page snapshots) is git-ignored.

**Regenerating after a Playwright upgrade:** run the `init-agents` command above, then:

1. Restore `"env": { "PW_AGENTS": "1" }` in `.mcp.json`.
2. Delete the regenerated `tests/seed.spec.ts`.
3. Review the diff of `.claude/agents/`.

**Playwright MCP server:** the standalone browser MCP server (`@playwright/mcp`) is not set up
separately. The test agents use the bundled `run-test-mcp-server`, which provides the browser
tools plus test-specific ones (`planner_setup_page`, `generator_write_test`, `test_debug`, …).

## How they were used

**Target:** the guest contact form at `/contact`. It had an accessibility scan but no functional
tests.

**How the agents were run:** each agent was run once, non-interactively, with Claude Code
2.1.299. Each run loaded only the project's MCP config and was allowed only that agent's tools.
The agents ran against the local Docker Toolshop and use the `sonnet` model set in their
generated definitions.

```bash
claude -p --agent playwright-test-planner --mcp-config .mcp.json --strict-mcp-config \
  --allowedTools "mcp__playwright-test__*" Read Glob Grep LS \
  "Create a test plan for the Contact page ... Use project 'agents' and seed file
   'tests/agents/seed.spec.ts' ... at most 6 scenarios. Save the plan as specs/contact-form.md."

claude -p --agent playwright-test-generator ... \
  "Generate tests for scenarios 1.2, 1.4 and 1.6 from specs/contact-form.md ..."

claude -p --agent playwright-test-healer ... --allowedTools ... Edit MultiEdit Write \
  "The test tests/ui/contact/message-length.spec.ts fails in the chromium project ... fix it."
```

### 1. Planner

**Produced:** [`specs/contact-form.md`](../specs/contact-form.md), kept as generated. It has six
scenarios:

1. Navigation.
2. Required fields.
3. Email format.
4. Message minimum length (49/50 boundary).
5. Subject options.
6. Successful submission.

It read exact validation messages from the live page, found the `POST /messages` request and
picked the right 49/50 boundary.

**Review against the Toolshop source** (`sprint5/UI/src/app/contact`) found three problems:

| Claim by the planner                                                             | Finding                                                                                                                                                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The success message appears only briefly", so assert immediately after Send     | **Wrong.** `showConfirmation` is set once and never reset; the message stays.                                                                                                                  |
| The subject dropdown lists "Select a subject *" as the first option              | **Misleading.** It is a `disabled hidden` placeholder, not a choosable option (the generator also noticed this).                                                                               |
| "My first manual submit showed no message and no POST… I haven't worked out why" | **A real app quirk, left unexplained.** The message field validates on blur. Its error box then appears or disappears and moves the Send button, so a click straight after typing can miss it. |

Scenarios 1.1 (navigation) and 1.5 (subject list) were not automated. They check static markup that
the accessibility scan and ARIA snapshots already cover. Step 2 of 1.3, which tries four invalid
emails, was cut to one: the others exercise Angular's built-in validator, not Toolshop.

### 2. Generator

**Produced:** three specs for scenarios 1.2, 1.4 and 1.6. They were written to
`tests/ui/contact/` and later deleted. On the first run, 9 of 12 passed (3 specs × chromium,
firefox, mobile-chrome). The message-length test failed in every browser.

**Problems found in review:**

- **Raw locators everywhere** (`page.getByTestId('first-name')`): no page object, no fixture and
  no tags. The framework keeps locators in page objects.
- **Hard-coded data** (`jane.doe@example.com`) instead of a unique Faker builder.
- **A non-retrying check right after a click**: `expect(messagePosts).toHaveLength(0)` on an
  array filled by `page.on('request')`. It passes before a late request could arrive, so it proves
  nothing.
- **An assertion that encoded a wrong assumption**: the error should disappear as soon as 50
  characters are typed. It only does on blur, which is why the test failed.
- It did not walk through 1.6 in the browser. It wrote that test from the 1.4 walkthrough, as it
  said itself.

### 3. Healer

**Produced:** it ran the failing test and debugged it. It concluded that **the app has an
off-by-one bug that rejects a 50-character message**, then added
`test.fixme(true, 'App rejects a 50-character message (off-by-one in min-length validation)')`
above the failing step.

**Rejected.** The source uses `Validators.minLength(50)`, which accepts 50 characters. A probe test
that blurred the field before clicking Send showed that 50 characters is accepted and the form
submits, in Chromium and Firefox. The real cause was the layout shift described above. Taking the
healer's fix would have hidden a working test behind `fixme` and filed a false app bug.

## What was committed

A human rewrote the specs to the framework's standards. Only the planner's plan and the seed come
from the agents.

- **`ContactPage`** (`src/app/pages/contact.page.ts`): label- and role-based locators, plus a
  `contactPage` fixture.
- **`enterMessage`** blurs the message field before Send. Its comment explains the layout shift.
- **`buildContactMessage`**: a Faker builder for unique, valid form data.
- **[`tests/ui/contact/contact-form.spec.ts`](../tests/ui/contact/contact-form.spec.ts)**, four
  tests tagged `@regression`:
  - required fields, with `test.step` for the two stages;
  - invalid email;
  - the 49/50 boundary, carrying a `ux-gap` annotation for the Send-button shift;
  - successful submission, which waits for the `POST /messages` response and checks it returned
    OK.
- The submission test carries a `retained-data` annotation, because Toolshop has no API to delete
  contact messages.

These pass on Chromium, Firefox, mobile Chrome and WebKit (Docker).

## Takeaways

- **The planner is the most useful agent.** It cheaply produces a list of scenarios with real
  messages, which can be checked against source code before any test exists.
- **Generator output is a draft.** It follows Playwright's best practices but not this
  framework's: page objects, builders and tags. Expect to rewrite it, and review any non-retrying
  assertions.
- **Do not accept a healer `fixme` without reproducing the failure yourself.** Its prompt tells it
  to mark a test `fixme` when it is "confident the test is correct", which turns a
  misunderstanding into a skipped test and a false bug report.
- Check every behavioural claim an agent makes, such as "appears briefly" or "off-by-one", against
  the source or a minimal probe.
