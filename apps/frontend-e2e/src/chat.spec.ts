import { test, expect } from '@playwright/test';

test('user can send a message and receive an assistant reply', async ({ page }) => {
  await page.goto('/');

  const textarea = page.getByTestId('message-input');
  await expect(textarea).toBeVisible();

  await textarea.fill('Hello from the Playwright E2E test.');
  await textarea.press('Enter');

  const assistantBubble = page
    .locator('app-message-bubble')
    .filter({ has: page.locator('.bg-gray-100') })
    .last();

  // Wait for a completed reply — the typing indicator shares .bg-gray-100 but has no text,
  // so we must wait for non-empty content rather than just visibility.
  await expect(assistantBubble).toHaveText(/.+/, { timeout: 60_000 });
  await expect(assistantBubble).not.toHaveText('Something went wrong. Please try again.');
});
