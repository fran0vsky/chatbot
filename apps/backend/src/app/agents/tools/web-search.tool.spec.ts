import { describe, it, expect, vi, afterEach } from 'vitest';
import { webSearchTool } from './web-search.tool';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('webSearchTool', () => {
  it('happy path — returns formatted top-5 results with title, snippet, and URL', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    const longContent = 'A'.repeat(300);
    const mockResults = [
      { title: 'Result One', url: 'https://example.com/1', content: 'Short content here.' },
      { title: 'Result Two', url: 'https://example.com/2', content: longContent },
      { title: 'Result Three', url: 'https://example.com/3', content: 'Another snippet.' },
      { title: 'Result Four', url: 'https://example.com/4', content: 'Fourth result content.' },
      { title: 'Result Five', url: 'https://example.com/5', content: 'Fifth result content.' },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: mockResults }),
    }));

    const result = await webSearchTool.invoke({ query: 'latest news' });

    expect(result).toContain('Result One');
    expect(result).toContain('https://example.com/1');
    expect(result).toContain('Result Two');
    expect(result).toContain('https://example.com/2');
    // Long content (300 chars) should be truncated to ~200 chars with ellipsis
    expect(result).not.toContain(longContent);
    expect(result).toContain('…');
    expect(result).toContain('Result Five');
  });

  it('unconfigured — returns unconfigured string and does NOT call fetch', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await webSearchTool.invoke({ query: 'latest news' });

    expect(result).toContain('TAVILY_API_KEY is not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rate-limited — returns rate-limit string on HTTP 429', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }));

    const result = await webSearchTool.invoke({ query: 'latest news' });

    expect(result).toContain('rate-limited');
    expect(result).toContain('over quota');
  });

  it('provider down — returns generic failure string on network error', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await webSearchTool.invoke({ query: 'latest news' });

    expect(result).toContain('Search failed');
    expect(result).toContain('ECONNREFUSED');
  });

  it('provider down — returns generic failure string on non-ok non-429 status', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const result = await webSearchTool.invoke({ query: 'latest news' });

    expect(result).toContain('Search failed');
    expect(result).toContain('500');
  });

  it('empty results — returns no-results string on empty results array', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    }));

    const result = await webSearchTool.invoke({ query: 'xyzzy123notfound' });

    expect(result).toContain('No results found for');
    expect(result).toContain('xyzzy123notfound');
  });
});
