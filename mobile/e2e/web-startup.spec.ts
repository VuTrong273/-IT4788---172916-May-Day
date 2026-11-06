import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844, label: 'phone' },
  { width: 1440, height: 900, label: 'desktop' },
]) {
  test(`Expo Web starts and renders the signed-out entry at ${viewport.label}`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page.getByText('MAY DAY')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(horizontalOverflow).toBe(false);
    expect(pageErrors).toEqual([]);
  });
}
