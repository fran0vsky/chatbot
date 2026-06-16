import { describe, it, expect, vi, afterEach } from 'vitest';
import { HealthController } from './health.controller';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('HealthController', () => {
  it('returns status ok and web_search true when TAVILY_API_KEY is set', () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-secret-key-abc123');
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.tools.web_search).toBe(true);
  });

  it('does not leak the TAVILY_API_KEY value in the response', () => {
    const secretValue = 'super-secret-tavily-key-xyz';
    vi.stubEnv('TAVILY_API_KEY', secretValue);
    const controller = new HealthController();
    const result = controller.check();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretValue);
  });

  it('returns web_search false when TAVILY_API_KEY is empty string', () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.tools.web_search).toBe(false);
  });

  it('returns web_search false when TAVILY_API_KEY is not set', () => {
    vi.stubEnv('TAVILY_API_KEY', undefined as unknown as string);
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.tools.web_search).toBe(false);
  });
});
