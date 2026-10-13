import type { Locator, Page, Response } from '@playwright/test';
import { NavBar } from '@app/components/nav-bar.component';
import { ProductCard } from '@app/components/product-card.component';

/** Bootstrap `col-md-*`: below this width the filter sidebar is collapsed behind a button. */
const FILTERS_COLLAPSE_BELOW_PX = 768;

export type SortOption =
  'Name (A - Z)' | 'Name (Z - A)' | 'Price (High - Low)' | 'Price (Low - High)';

/** The home page: product grid with search, sort and filters. */
export class ProductListingPage {
  readonly nav: NavBar;
  readonly productCards: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  readonly searchBox: Locator;
  readonly searchCaption: Locator;
  readonly searchResultCount: Locator;
  readonly noResults: Locator;
  readonly sortSelect: Locator;
  readonly filtersToggle: Locator;

  constructor(private readonly page: Page) {
    this.nav = new NavBar(page);
    this.productCards = page.getByTestId(/^product-[0-9A-Za-z]{26}$/);
    this.productNames = this.productCards.getByTestId('product-name');
    this.productPrices = this.productCards.getByTestId('product-price');
    this.searchBox = page.getByRole('textbox', { name: 'Search' });
    this.searchCaption = page.getByTestId('search-caption');
    this.searchResultCount = page.getByTestId('search-result-count');
    this.noResults = page.getByTestId('no-results');
    this.sortSelect = page.getByTestId('sort');
    this.filtersToggle = page.getByRole('button', { name: 'Filters' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  cardAt(index: number): ProductCard {
    return new ProductCard(this.productCards.nth(index));
  }

  productCard(name: string): ProductCard {
    return new ProductCard(
      this.productCards.filter({
        has: this.page.getByTestId('product-name').getByText(name, { exact: true }),
      }),
    );
  }

  async search(term: string): Promise<void> {
    await this.showFilters();
    await this.searchBox.fill(term);
    await this.untilProductsReload(() =>
      this.page.getByRole('button', { name: 'Search', exact: true }).click(),
    );
  }

  async filterByCategory(category: string): Promise<void> {
    await this.showFilters();
    await this.untilProductsReload(() =>
      this.page.getByRole('checkbox', { name: category, exact: true }).check(),
    );
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.showFilters();
    await this.untilProductsReload(() => this.sortSelect.selectOption({ label: option }));
  }

  /** Price strings like "$14.15" from the cards currently shown. */
  async visiblePrices(): Promise<number[]> {
    const prices = await this.productPrices.allTextContents();
    return prices.map((price) => Number(price.replace(/[^0-9.]/g, '')));
  }

  /** On narrow viewports the sidebar (search, sort, filters) is collapsed. */
  private async showFilters(): Promise<void> {
    const width = this.page.viewportSize()?.width ?? Number.POSITIVE_INFINITY;
    if (
      width < FILTERS_COLLAPSE_BELOW_PX &&
      (await this.filtersToggle.getAttribute('aria-expanded')) !== 'true'
    ) {
      await this.filtersToggle.click();
    }
  }

  /**
   * Performs an action that re-queries the product API and resolves once the
   * new results have arrived, so assertions never run against the stale grid.
   */
  private async untilProductsReload(action: () => Promise<unknown>): Promise<void> {
    const reloaded = this.page.waitForResponse(isProductQuery);
    await action();
    await reloaded;
  }
}

// Toolshop reads products with the HTTP QUERY method, so match on the path only.
function isProductQuery(response: Response): boolean {
  const { pathname } = new URL(response.url());
  return /^\/products(\/search)?$/.test(pathname);
}
