import { expect, test } from '@app/fixtures';

// ARIA snapshots pin the accessibility tree of key components: roles, names
// and structure that assistive technology relies on. Unlike screenshots they
// ignore styling, so they are stable across browsers and platforms.

test.describe('Accessibility tree of key components', { tag: '@a11y' }, () => {
  test('main menu for a guest', async ({ productListingPage, page }) => {
    await productListingPage.goto();

    await expect(page.getByRole('menubar', { name: 'Main menu' })).toMatchAriaSnapshot(`
      - menubar "Main menu":
        - menuitem "Home":
          - link "Home"
        - menuitem "Categories":
          - button "Categories"
        - menuitem "Contact":
          - link "Contact"
        - menuitem "Sign in":
          - link "Sign in"
    `);
  });

  test('sort options on the product listing', async ({ productListingPage }) => {
    await productListingPage.goto();

    await expect(productListingPage.sortSelect).toMatchAriaSnapshot(`
      - combobox "sort":
        - option "Name (A - Z)"
        - option "Name (Z - A)"
        - option "Price (High - Low)"
        - option "Price (Low - High)"
        - option "CO₂ Rating (A - E)"
        - option "CO₂ Rating (E - A)"
    `);
  });

  test('login form', async ({ loginPage, page }) => {
    await loginPage.goto();

    // The unnamed button is the password visibility toggle, a known
    // violation in src/app/a11y/baseline.ts.
    await expect(page.getByTestId('login-form')).toMatchAriaSnapshot(`
      - textbox "Email address *"
      - textbox "Password *"
      - button
      - button "Login"
    `);
  });

  test('cart table and checkout steps', async ({ testData, productDetailPage, cartPage, page }) => {
    const product = await testData.product({ price: 12.5 });
    await productDetailPage.goto(product.id);
    await productDetailPage.addToCart(2);
    await expect(productDetailPage.nav.cartQuantity).toHaveText('2');

    await cartPage.goto();

    await expect(page.getByRole('list').filter({ hasText: 'Billing Address' }))
      .toMatchAriaSnapshot(`
      - list:
        - listitem: Cart 1
        - listitem: Sign in 2
        - listitem: Billing Address 3
        - listitem: Payment 4
    `);
    await expect(page.getByRole('table')).toMatchAriaSnapshot(`
      - table:
        - rowgroup:
          - row "Item Quantity Price Total":
            - columnheader "Item"
            - columnheader "Quantity"
            - columnheader "Price"
            - columnheader "Total"
        - rowgroup:
          - row:
            - cell "${product.name}"
            - cell "Quantity for ${product.name}":
              - spinbutton "Quantity for ${product.name}": "2"
            - cell "$12.50"
            - cell "$25.00"
        - rowgroup:
          - row "Total $25.00"
    `);
  });
});
