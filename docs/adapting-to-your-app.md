# Adapting this framework to your app

This repository is a GitHub template. Click **Use this template** to get your own copy, then
replace the Toolshop-specific parts. `src/core` stays as it is. It knows nothing about Toolshop and
compiles on its own (`npm run typecheck:core`).

## 1. Remove Toolshop

Delete these:

| Path                                                               | What it is                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `src/app/*` (keep the folder structure as a guide if you like)     | Toolshop pages, components, API clients, schemas, data, a11y baseline |
| `tests/ui`, `tests/e2e`, `tests/api`, `tests/a11y`, `tests/visual` | Toolshop specs, HAR and screenshot baselines                          |
| `specs/contact-form.md`                                            | Agent-generated test plan                                             |
| `docker-compose.yml`, `docker/`                                    | The Toolshop stack                                                    |
| `CHANGELOG.md` entries                                             | Start your own `[Unreleased]` section                                 |

Keep `tests/setup` (rewrite its contents), `tests/agents/seed.spec.ts` (update it in step 7),
`src/core`, the configs, the workflows and `docs/decisions` (they explain why things are the way
they are).

Then check that the core still stands alone:

```bash
npm run typecheck:core && npm run lint:boundary
```

## 2. Configure environments

`src/app/config/index.ts` declares the environments, their URLs and the variables your app needs:

```ts
const environments = {
  local: { BASE_URL: 'http://localhost:3000', API_URL: 'http://localhost:3001' },
  staging: { BASE_URL: 'https://staging.example.com', API_URL: 'https://api.staging.example.com' },
};

const appEnvSchema = baseEnvSchema
  .extend({ ADMIN_EMAIL: z.email(), ADMIN_PASSWORD: z.string().min(1) })
  .transform((env) => ({
    environment: env.TEST_ENV,
    baseUrl: env.BASE_URL,
    apiUrl: env.API_URL,
    users: { admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD } },
  }));

export const config = loadConfig({
  schema: appEnvSchema,
  environments,
  defaultEnvironment: 'local',
});
```

- **Add an environment:** add a key to `environments` and run with `TEST_ENV=<key>`. `BASE_URL`
  and `API_URL` can still be overridden per run.
- **Document every variable** in `.env.example` and the README.
- **Add CI secrets** to the workflows' `env:` blocks.
- In `playwright.config.ts`, change `testIdAttribute` if your app does not use `data-test`.

## 3. Add an API client

Write a Zod schema, then a client that extends `BaseApiClient`. Types come from the schema:

```ts
// src/app/schemas/order.schema.ts
export const orderSchema = z.object({
  id: z.string(),
  total: z.number(),
  status: z.enum(['open', 'paid']),
});
export type Order = z.infer<typeof orderSchema>;
export type OrderInput = Pick<Order, 'total'>;

// src/app/api/orders.api.ts
export class OrdersApi extends BaseApiClient {
  createResponse(input: Partial<OrderInput>): Promise<APIResponse> {
    return this.send('POST', '/orders', { data: input });
  }

  async create(input: OrderInput): Promise<Order> {
    return this.parse(await this.createResponse(input), orderSchema, 201);
  }

  deleteResponse(id: string): Promise<APIResponse> {
    return this.send('DELETE', `/orders/${id}`);
  }
}
```

Next:

1. Register the client in `createToolshopApi` (`src/app/api/index.ts`); rename that function for
   your app.
2. Every API fixture (`api`, `adminApi`, `apiWithToken`) then has it.
3. Use `xResponse` methods in negative tests and the parsed methods everywhere else.

To give tests data that cleans itself up, add a builder (`defineFactory`) and a method on
`TestData` that creates the entity and registers its deletion with `deleteLater`.

## 4. Add a page object

```ts
// src/app/pages/orders.page.ts
export class OrdersPage {
  readonly heading: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Orders' });
    this.rows = page.getByRole('row');
  }

  async goto(): Promise<void> {
    await this.page.goto('/orders');
  }

  async open(orderId: string): Promise<void> {
    await this.rows.filter({ hasText: orderId }).getByRole('link', { name: 'View' }).click();
  }
}
```

Then:

1. Export it from `src/app/pages/index.ts`.
2. Add a fixture in `src/app/fixtures/pages.fixture.ts`:
   `ordersPage: async ({ page }, use) => { await use(new OrdersPage(page)); }`.
3. Tests ask for `ordersPage`.

Rules for page objects:

- Use locators by role, label, text or test id. ESLint rejects raw CSS and XPath.
- Methods express intent.
- Assertions stay in tests.
- Name a method after the field it acts on, not `fill`/`click`/`type`. ESLint's
  `prefer-locator` rule reads `somePage.fill(...)` as a call on a Playwright `Page`.

Repeated UI parts (nav bars, cards, table rows) go in `src/app/components`.

## 5. Add a role

1. Add the role's credentials to the config schema (`users: { admin, viewer }`) and to
   `.env.example`.
2. Add the role to `roles` in `src/app/config/index.ts`. `tests/setup/auth.setup.ts` then creates
   `.auth/<role>.json` for it.
3. Make the auth setup produce a session for your app. If it keeps a token in `localStorage`, use
   `localStorageState(origin, { key: token })` as Toolshop does. If it uses cookies, save
   `request.storageState()` after an API login instead.
4. Use it in a spec with `test.use({ storageState: authFile('viewer') })`. For API calls as that
   role, add a fixture like `adminApi` in `src/app/fixtures/api.fixture.ts`.

## 6. Point CI at your app

- **Running the app under test:** replace the `start-toolshop` composite action
  (`.github/actions/start-toolshop`) with whatever starts your app and seeds it. If you test a
  deployed environment, delete it and set `TEST_ENV` in the workflows.
- **Secrets:** add your app's secrets to the repository and to the workflows' `env:` blocks.
- **Smoke run:** keep `@smoke` small; PRs run it on Chromium and one mobile device.
- **Report:** enable GitHub Pages (Source: **GitHub Actions**) for the nightly report.
- **Renovate:** install the Renovate app, and remove the Toolshop rule from `renovate.json`.
- **Health check:** update `tests/setup/health.setup.ts` with your app's health endpoint.

## 7. Optional parts

- **Accessibility:** call `scanAccessibility` with your app's pages, and record known violations in
  `src/app/a11y/baseline.ts`, with a reason for each rule.
- **Visual:** write specs in `tests/visual`, then run `npm run test:visual:update` to create the
  first baselines inside Docker.
- **Allure:** `npm run test:allure`, then `npm run allure:generate`. Remove `allure` and
  `allure-playwright` if you don't need it.
- **Playwright test agents:** update `tests/agents/seed.spec.ts` to open your app, then follow
  [ai-assisted-testing.md](ai-assisted-testing.md).
- **Toolshop-specific workarounds:** these are documented where they live: the Redis cache, the
  guest checkout for Clock tests, and the `retained-data` annotation. Delete the ones that do not
  apply to your app.
