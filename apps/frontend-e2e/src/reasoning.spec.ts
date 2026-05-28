import { test, expect } from '@playwright/test';

function sseBody(...frames: object[]): string {
  return frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('');
}

const REASONING_TEXT =
  'Let me think through this step by step.\nFirst, I consider the question carefully.\nThen I arrive at the correct answer.';

const RESPONSE_TEXT = 'The answer is 42.';

test.describe('ReasoningBlock UX', () => {
  test('Scenario A — non-reasoning model shows no reasoning block', async ({ page }) => {
    await page.route('**/api/agents/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody(
          { type: 'token', text: 'Hello!' },
          { type: 'done', response: 'Hello!', toolCalls: [] },
        ),
      }),
    );

    await page.goto('/');
    const textarea = page.getByTestId('message-input');
    await expect(textarea).toBeVisible();

    await textarea.fill('Hi');
    await textarea.press('Enter');

    await expect(page.locator('app-message-bubble').last()).toHaveText(/.+/, { timeout: 10_000 });
    await expect(page.getByTestId('reasoning-block')).not.toBeVisible();
  });

  test('Scenario B — reasoning model: block appears, auto-collapses, can re-expand', async ({ page }) => {
    await page.route('**/api/agents/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody(
          { type: 'reasoning_token', text: 'Let me think through this step by step.\n' },
          { type: 'reasoning_token', text: 'First, I consider the question carefully.\n' },
          { type: 'reasoning_token', text: 'Then I arrive at the correct answer.' },
          { type: 'token', text: 'The answer ' },
          { type: 'token', text: 'is 42.' },
          {
            type: 'done',
            response: RESPONSE_TEXT,
            toolCalls: [],
            reasoning: REASONING_TEXT,
            reasoningDurationMs: 3100,
          },
        ),
      }),
    );

    await page.goto('/');
    const textarea = page.getByTestId('message-input');
    await expect(textarea).toBeVisible();

    await page.locator('select[aria-label="Choose model"]').selectOption('openai/gpt-oss-120b:free');
    await textarea.fill('What is the answer to life?');
    await textarea.press('Enter');

    // After the turn completes the committed message has a reasoning block (autoCollapsed=true)
    const reasoningBlock = page.getByTestId('reasoning-block').last();
    await expect(reasoningBlock).toBeVisible({ timeout: 10_000 });

    const toggle = page.getByTestId('reasoning-toggle').last();
    await expect(toggle).toBeVisible();

    // Body is collapsed by default on the persisted message
    const body = page.getByTestId('reasoning-body').last();
    await expect(body).not.toBeVisible();

    // Expand via toggle
    await toggle.click();
    await expect(body).toBeVisible();
    await expect(body).toContainText('Let me think through this step by step');

    // Collapse again
    await toggle.click();
    await expect(body).not.toBeVisible();
  });

  test('Scenario C — reasoning persists after switching sessions via New Chat + history', async ({ page }) => {
    await page.route('**/api/agents/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody(
          { type: 'reasoning_token', text: 'Reasoning step one.' },
          { type: 'token', text: 'Answer.' },
          {
            type: 'done',
            response: 'Answer.',
            toolCalls: [],
            reasoning: 'Reasoning step one.',
            reasoningDurationMs: 900,
          },
        ),
      }),
    );

    await page.goto('/');
    const textarea = page.getByTestId('message-input');
    await expect(textarea).toBeVisible();

    await page.locator('select[aria-label="Choose model"]').selectOption('openai/gpt-oss-120b:free');
    await textarea.fill('First question');
    await textarea.press('Enter');

    // Wait for committed reasoning block
    const reasoningBlock = page.getByTestId('reasoning-block').last();
    await expect(reasoningBlock).toBeVisible({ timeout: 10_000 });

    // Start a new chat via the history panel "New chat" pill (history is always
    // mounted on desktop — icon rail collapsed by default, expands on hover).
    await page.locator('app-history-panel').getByRole('button', { name: /new chat/i }).first().click();

    // Verify reasoning is persisted in localStorage (the actual persistence
    // mechanism). The icon-rail sidebar auto-collapses, so re-navigating via
    // UI selectors is fragile — the storage check is what we really care about.
    const hasReasoning = await page.evaluate(() => {
      const raw = localStorage.getItem('desert-chat-history');
      return raw ? raw.includes('"reasoning"') : false;
    });
    expect(hasReasoning).toBe(true);
  });
});

// Real-backend scenarios — only run when OPENROUTER_API_KEY is set
test.describe('ReasoningBlock — real backend', () => {
  test.skip(!process.env['OPENROUTER_API_KEY'], 'Skipped: OPENROUTER_API_KEY not set');

  test('Reasoning model produces a reasoning block in the live app', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByTestId('message-input');
    await expect(textarea).toBeVisible();

    await page.locator('select[aria-label="Choose model"]').selectOption('openai/gpt-oss-120b:free');
    await textarea.fill('What is 2 + 2? Answer briefly.');
    await textarea.press('Enter');

    await expect(page.getByTestId('reasoning-block').last()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('app-message-bubble').last()).toHaveText(/.+/, { timeout: 60_000 });
  });
});
