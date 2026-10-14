import { expect, test } from '@app/fixtures';

// The payment step rejects a card whose MM/YYYY expiry is before the current
// month, using the browser's clock. The Clock API pins "now" so the boundary
// is tested on fixed dates rather than whatever day the suite happens to run.
// A guest checkout is used: a signed-in session would look expired to the app
// with the browser clock set years ahead.

test(
  'card expiry is validated against the current month',
  { tag: '@regression' },
  async ({ page, testData, uniqueId, productDetailPage, checkoutPage }) => {
    // Time keeps flowing from this instant, so the app's debounced inputs still fire.
    await page.clock.install({ time: new Date('2031-03-15T12:00:00') });
    const product = await testData.product();

    await test.step('reach the payment step as a guest', async () => {
      await productDetailPage.goto(product.id);
      await productDetailPage.addToCart();
      await expect(productDetailPage.nav.cartQuantity).toHaveText('1');
      await checkoutPage.cart.goto();
      await checkoutPage.proceedFromCart();
      await checkoutPage.continueAsGuest({
        email: `guest-${uniqueId}@example.com`,
        firstName: 'Guest',
        lastName: 'Shopper',
      });
      await checkoutPage.enterBillingAddress({
        country: 'US',
        postcode: '10001',
        houseNumber: '1',
      });
      await expect(checkoutPage.city).not.toBeEmpty();
      await checkoutPage.proceedFromBillingAddress();
      await checkoutPage.paymentMethod.selectOption('credit-card');
    });

    await test.step('on 15 March 2031, February 2031 has expired', async () => {
      await checkoutPage.enterCardExpiry('02/2031');
      await expect(checkoutPage.cardExpiryInPastError).toBeVisible();
    });

    await test.step('on 15 March 2031, March 2031 is still valid', async () => {
      await checkoutPage.enterCardExpiry('03/2031');
      await expect(checkoutPage.cardExpiryInPastError).toBeHidden();
    });

    await test.step('once April starts, March 2031 has expired', async () => {
      await page.clock.setSystemTime(new Date('2031-04-01T00:00:01'));
      // Re-entering an unchanged value would not re-run validation, so change it first.
      await checkoutPage.enterCardExpiry('04/2031');
      await checkoutPage.enterCardExpiry('03/2031');
      await expect(checkoutPage.cardExpiryInPastError).toBeVisible();
    });
  },
);
