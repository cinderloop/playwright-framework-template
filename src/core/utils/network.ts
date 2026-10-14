import type { Page, Route } from '@playwright/test';

/**
 * Matches requests to exactly `pathname` on the origin of `baseUrl`, whatever
 * the query string or HTTP method. Useful with `page.route`.
 */
export function endpoint(baseUrl: string, pathname: string): (url: URL) => boolean {
  const { origin } = new URL(baseUrl);
  return (url) => url.origin === origin && url.pathname === pathname;
}

export interface HeldRequests {
  /** Resolves when the first matching request has been intercepted. */
  intercepted: Promise<void>;
  /** Lets every held (and future) request continue to the server. */
  release: () => void;
}

/**
 * Holds matching requests until `release()` is called, to observe loading
 * states deterministically instead of with arbitrary delays.
 */
export async function holdRequests(
  page: Page,
  matcher: (url: URL) => boolean,
): Promise<HeldRequests> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markIntercepted!: () => void;
  const intercepted = new Promise<void>((resolve) => {
    markIntercepted = resolve;
  });

  await page.route(matcher, async (route: Route) => {
    markIntercepted();
    await released;
    await route.fallback();
  });
  return { intercepted, release };
}
