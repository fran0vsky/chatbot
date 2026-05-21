import { test, expect } from '@playwright/test';

test('user can send a message and receive an assistant reply', async ({ page }) => {
  await page.goto('/');

  const textarea = page.getByTestId('message-input');
  await expect(textarea).toBeVisible();

  await textarea.fill('Hello from the Playwright E2E test.');
  await textarea.press('Enter');

  const assistantBubble = page
    .locator('app-message-bubble')
    .filter({ has: page.locator('.markdown-bubble') })
    .last();

  // Wait for a completed reply — .markdown-bubble only appears on finished assistant messages,
  // not the typing indicator, so presence implies content is ready.
  await expect(assistantBubble).toHaveText(/.+/, { timeout: 60_000 });
  await expect(assistantBubble).not.toHaveText('Something went wrong. Please try again.');
});
