import { signInWithToken } from '@app/auth';
import { expect, test } from '@app/fixtures';

test(
  'a new customer buys a product and the order reaches their invoice history',
  { tag: ['@smoke', '@regression'] },
  async ({ page, testData, productDetailPage, checkoutPage, invoicesPage }) => {
    // Arrange through the API: a fresh customer and a product nobody else uses.
    // Orders cannot be deleted, so both are retained afterwards (annotated).
    const [customer, product] = await Promise.all([testData.customer(), testData.product()]);
    const { address } = customer.user;
    await signInWithToken(page.context(), customer.token);

    await test.step('add two units to the cart', async () => {
      await productDetailPage.goto(product.id);
      await productDetailPage.addToCart(2);
      await expect(productDetailPage.nav.cartQuantity).toHaveText('2');
    });

    await test.step('review the cart', async () => {
      await checkoutPage.cart.goto();
      await expect(checkoutPage.cart.item(product.name).quantity).toHaveValue('2');
      await checkoutPage.proceedFromCart();
    });

    await test.step('continue as the signed-in customer', async () => {
      await expect(checkoutPage.signedInMessage).toContainText(customer.user.first_name);
      await checkoutPage.proceedAsSignedInCustomer();
    });

    await test.step('enter the billing address; the lookup fills in the rest', async () => {
      await checkoutPage.enterBillingAddress({
        country: address.country ?? '',
        postcode: address.postal_code ?? '',
        houseNumber: address.house_number ?? '1',
      });
      await expect(checkoutPage.city).toHaveValue(address.city ?? '');
      await expect(checkoutPage.state).toHaveValue(address.state ?? '');
      await checkoutPage.proceedFromBillingAddress();
    });

    const invoiceNumber = await test.step('pay cash on delivery and confirm', async () => {
      await checkoutPage.checkPayment('cash-on-delivery');
      await expect(checkoutPage.paymentSuccess).toBeVisible();
      await checkoutPage.confirmOrder();
      await expect(checkoutPage.orderConfirmation).toContainText(/INV-\d+/);
      return checkoutPage.invoiceNumber();
    });

    await test.step('the API has the invoice with the right lines and total', async () => {
      const { data: invoices } = await customer.api.invoices.list();
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({
        invoice_number: invoiceNumber,
        payment: { payment_method: 'cash-on-delivery' },
        invoicelines: [expect.objectContaining({ product_id: product.id, quantity: 2 })],
      });
      expect(invoices[0]?.total).toBeCloseTo(product.price * 2, 2);
    });

    await test.step('the order is listed in the account invoice history', async () => {
      await invoicesPage.goto();
      await expect(invoicesPage.invoiceRow(invoiceNumber)).toBeVisible();
    });
  },
);
