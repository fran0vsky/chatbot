import { Page, expect } from '@playwright/test';

/**
 * Navigate to the app and land in the chat view with the composer ready.
 *
 * Since the welcome/onboarding screen (no-dino state) now renders the dino
 * picker instead of the chat composer on a fresh load, every flow must first
 * choose a dino. This selects the first available dino card, then waits for the
 * message composer to appear before returning it.
 */
export async function goToChat(page: Page) {
  await page.goto('/');

  // Welcome screen: pick the first dino to enter the chat view. The card is a
  // button inside <app-dino-card>; Playwright auto-waits for the roster to load.
  await page.locator('app-dino-card button').first().click();

  const textarea = page.getByTestId('message-input');
  await expect(textarea).toBeVisible();
  return textarea;
}
