import { test, expect } from '@playwright/test';

test('user can send a message and receive an assistant reply', async ({ page }) => {
  await page.goto('/');

  const textarea = page.getByPlaceholder('Message');
  await expect(textarea).toBeVisible();

  await textarea.fill('Hello from the Playwright E2E test.');
  await textarea.press('Enter');

  const assistantBubble = page
    .locator('app-message-bubble')
    .filter({ has: page.locator('.bg-gray-100') })
    .last();

  await expect(assistantBubble).toBeVisible({ timeout: 60_000 });
  await expect(assistantBubble).not.toHaveText('Something went wrong. Please try again.');

  const text = await assistantBubble.innerText();
  expect(text.length).toBeGreaterThan(0);
});
