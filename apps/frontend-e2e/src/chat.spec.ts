import { test, expect } from '@playwright/test';
import { goToChat } from './support/go-to-chat';

test('user can send a message and receive an assistant reply', async ({ page }) => {
  const textarea = await goToChat(page);

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
