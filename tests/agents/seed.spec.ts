import { expect, test } from '@app/fixtures';

// Starting point for the Playwright test agents (planner, generator, healer):
// they run this test to get a page in a known state, then explore from there.
// Runs only in the `agents` project, which exists when PW_AGENTS=1 (.mcp.json).
test('seed', async ({ productListingPage }) => {
  await productListingPage.goto();
  await expect(productListingPage.productCards.first()).toBeVisible();
});
