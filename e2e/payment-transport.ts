import type { BrowserContext, Page } from "@playwright/test";

export async function recordTransactionCredentials(context: BrowserContext) {
  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname.includes("/api/v1/")) {
        const records = JSON.parse(sessionStorage.getItem("test.payment-transport") || "[]");
        records.push({
          path: url.pathname,
          method: init?.method || (input instanceof Request ? input.method : "GET"),
          credentials: init?.credentials || (input instanceof Request ? input.credentials : "same-origin"),
        });
        sessionStorage.setItem("test.payment-transport", JSON.stringify(records));
      }
      return originalFetch(input, init);
    };
  });
}

export function transactionCredentials(page: Page): Promise<Array<{ path: string; method: string; credentials: string }>> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("test.payment-transport") || "[]"));
}
