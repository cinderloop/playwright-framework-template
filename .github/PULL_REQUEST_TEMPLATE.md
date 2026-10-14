## What and why

<!-- What this changes and the reason for it. Link issues. -->

## How it was tested

<!-- Commands run and their results, e.g. `npm test`, `npm run test:docker`. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm run format:check` pass
- [ ] New tests create their own data and clean it up; they pass with `fullyParallel`
- [ ] Locators are user-facing (role, label, text, test id); no `waitForTimeout`, `force: true` or XPath
- [ ] Nothing app-specific added to `src/core`
- [ ] Visual baselines regenerated with `npm run test:visual:update` if the UI or Playwright changed
- [ ] Docs and `CHANGELOG.md` updated if behaviour or setup changed
