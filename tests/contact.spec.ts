import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: 'http://127.0.0.1:4174' });

async function fillContact(page: import('@playwright/test').Page) {
  await page.locator('#contact-name').fill('Ada Lovelace');
  await page.locator('#contact-email').fill('ada@example.test');
  await page.locator('#contact-message').fill('Please test this signal.');
}

test('configured contact form submits controlled data and reports success', async ({ page }) => {
  let submitted = false;
  let releaseResponse: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route('https://api.web3forms.com/submit', async (route) => {
    submitted = true;
    const body = route.request().postData() ?? '';
    expect(body).toContain('playwright-fake-access-key');
    await responseReady;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'sent' }) });
  });
  await page.goto('/');
  await fillContact(page);
  await page.locator('#contact-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#contact-submit')).toBeDisabled();
  releaseResponse?.();
  await expect(page.locator('#contact-form-status')).toContainText(/sent|received|success/i);
  await expect(page.locator('#contact-submit')).toBeEnabled();
  expect(submitted).toBe(true);
});

test('configured form is accessible and rejects invalid fields locally', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.locator('#contact-submit').click();
  await expect(page.locator('#contact-name')).toBeFocused();
  await expect(page.locator('#contact-form-status')).toBeEmpty();
});

test('malformed provider responses preserve text and allow a successful retry', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.web3forms.com/submit', (route) => {
    requests++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: requests === 1 ? 'invalid json' : '{"success":true}' });
  });
  await page.goto('/');
  await fillContact(page);
  await page.locator('#contact-submit').click();
  await expect(page.locator('#contact-form-status')).toContainText('unreadable response');
  await expect(page.locator('#contact-message')).toHaveValue('Please test this signal.');
  await page.locator('#contact-submit').click();
  await expect(page.locator('#contact-form-status')).toContainText('Message sent');
  await expect(page.locator('#contact-message')).toHaveValue('');
});

test('timeout and navigation interruption release the form without losing text', async ({ page }) => {
  await page.route('https://api.web3forms.com/submit', () => {});
  await page.goto('/');
  await fillContact(page);
  await page.clock.install();
  await page.locator('#contact-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.clock.fastForward(12_100);
  await expect(page.locator('#contact-form-status')).toContainText('timed out');
  await expect(page.locator('#contact-submit')).toBeEnabled();
  await page.locator('#contact-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('#contact-submit')).toBeEnabled();
  await expect(page.locator('#contact-form-status')).toContainText('interrupted');
  await expect(page.locator('#contact-message')).toHaveValue('Please test this signal.');
});

test('configured form retains its native no-JS submission path', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  let submitted = false;
  await page.route('https://api.web3forms.com/submit', (route) => {
    submitted = route.request().method() === 'POST';
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Controlled form receipt</h1>' });
  });
  await page.goto('http://127.0.0.1:4174');
  await fillContact(page);
  await page.locator('#contact-submit').click();
  await expect(page.getByRole('heading', { name: 'Controlled form receipt' })).toBeVisible();
  expect(submitted).toBe(true);
  await context.close();
});

test('configured contact form retains fields and recovers after provider error', async ({ page }) => {
  await page.route('https://api.web3forms.com/submit', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'try again' }) }),
  );
  await page.goto('/');
  await fillContact(page);
  await page.locator('#contact-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#contact-form-status')).toContainText(/try again|unable|error/i);
  await expect(page.locator('#contact-form-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#contact-submit')).toBeEnabled();
  await expect(page.locator('#contact-name')).toHaveValue('Ada Lovelace');
  await expect(page.locator('#contact-email')).toHaveValue('ada@example.test');
  await expect(page.locator('#contact-message')).toHaveValue('Please test this signal.');
});
