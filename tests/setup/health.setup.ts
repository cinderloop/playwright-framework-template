import { expect, test as setup } from '@app/fixtures';

// Fails fast with a clear message when Toolshop is not running, instead of
// letting every test time out.
setup('Toolshop API and UI are reachable', async ({ request, config }) => {
  const status = await request
    .get(new URL('/status', config.apiUrl).href)
    .catch((error: unknown) => {
      throw new Error(
        `Toolshop API is not reachable at ${config.apiUrl}. ` +
          'For TEST_ENV=local run `npm run toolshop:start` first.',
        { cause: error },
      );
    });
  expect(status.ok(), `GET ${config.apiUrl}/status`).toBe(true);

  const ui = await request.get(config.baseUrl);
  expect(ui.ok(), `GET ${config.baseUrl}`).toBe(true);
});
