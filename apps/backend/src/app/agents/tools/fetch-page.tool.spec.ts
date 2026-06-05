import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPageTool } from './fetch-page.tool';

/** Build a minimal mock Response-like object for vi.stubGlobal('fetch'). */
function mockFetch(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  contentLength?: string | null;
  body?: string;
}) {
  const {
    ok = true,
    status = 200,
    contentType = 'text/html',
    contentLength = null,
    body = '',
  } = opts;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: {
      get: (name: string) => {
        if (name === 'content-type') return contentType;
        if (name === 'content-length') return contentLength;
        return null;
      },
    },
    text: vi.fn().mockResolvedValue(body),
  });
}

const HTML_FIXTURE = `
<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <nav>Nav Menu Item 1 | Nav Menu Item 2</nav>
  <header>Site Header Content</header>
  <article>
    <h1>Main Heading</h1>
    <p>First paragraph of the article body.</p>
    <h2>Sub Heading</h2>
    <p>Second paragraph with more detail.</p>
  </article>
  <footer>Footer copyright text</footer>
  <script>var chrome = "script content should be excluded";</script>
</body>
</html>
`;

/** No <title>, no <article>/<main>, no <p>/<h1>/<li> — forces the soft-fallback path. */
const HTML_NO_ARTICLE = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <div>
    <span>Some body fallback text that should appear in the result.</span>
  </div>
</body>
</html>
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPageTool', () => {
  it('extracts title, headings, and paragraphs from an HTML fixture and excludes chrome', async () => {
    vi.stubGlobal('fetch', mockFetch({ body: HTML_FIXTURE }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/article' });

    // Title should be present
    expect(result).toContain('Test Article');

    // Main headings and body
    expect(result).toContain('Main Heading');
    expect(result).toContain('Sub Heading');
    expect(result).toContain('First paragraph of the article body.');
    expect(result).toContain('Second paragraph with more detail.');

    // Chrome should NOT be present
    expect(result).not.toContain('Nav Menu Item');
    expect(result).not.toContain('Footer copyright text');
    expect(result).not.toContain('script content should be excluded');
    expect(result).not.toContain('Site Header Content');
  });

  it('soft-falls-back to body text when no article/main found', async () => {
    vi.stubGlobal('fetch', mockFetch({ body: HTML_NO_ARTICLE }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/noarticle' });

    // Should return some body text, not empty
    expect(result).toBeTruthy();
    expect(result).not.toBe('');
    expect(result).toContain('Some body fallback text');
  });

  it('returns cleaned raw text for non-HTML content type (application/json)', async () => {
    const jsonBody = '{"message": "hello world", "value": 42}';
    vi.stubGlobal('fetch', mockFetch({ contentType: 'application/json', body: jsonBody }));

    const result = await fetchPageTool.invoke({ url: 'https://api.example.com/data' });

    expect(result).toContain('hello world');
    expect(result).toContain('42');
  });

  it('returns cleaned raw text for text/plain content type', async () => {
    const plainBody = 'This is plain text content.';
    vi.stubGlobal('fetch', mockFetch({ contentType: 'text/plain', body: plainBody }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/readme.txt' });

    expect(result).toContain('This is plain text content.');
  });

  it('refuses binary content (application/pdf) without dumping bytes', async () => {
    const fakePdfBytes = '%PDF-1.4 binary garbage \x00\x01\x02\x03';
    const textFn = vi.fn().mockResolvedValue(fakePdfBytes);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'application/pdf';
          if (name === 'content-length') return null;
          return null;
        },
      },
      text: textFn,
    }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/doc.pdf' });

    expect(result).toContain('Unsupported content type');
    expect(result).toContain('application/pdf');
    // text() should NOT have been called (body not read)
    expect(textFn).not.toHaveBeenCalled();
  });

  it('refuses binary content (image/png) without dumping bytes', async () => {
    const textFn = vi.fn().mockResolvedValue('\x89PNG binary data');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'image/png';
          if (name === 'content-length') return null;
          return null;
        },
      },
      text: textFn,
    }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/photo.png' });

    expect(result).toContain('Unsupported content type');
    expect(result).toContain('image/png');
    expect(textFn).not.toHaveBeenCalled();
  });

  it('returns oversized error when Content-Length exceeds MAX_BYTES', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/html';
          if (name === 'content-length') return '3000000'; // 3MB > 2.5MB cap
          return null;
        },
      },
      text: vi.fn().mockResolvedValue('<html></html>'),
    }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/huge.html' });

    expect(result).toContain('too large');
  });

  it('returns error for HTTP failure status', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 404, body: 'Not Found' }));

    const result = await fetchPageTool.invoke({ url: 'https://example.com/missing' });

    expect(result).toContain('404');
  });

  it('refuses non-http/https protocols', async () => {
    const result = await fetchPageTool.invoke({ url: 'file:///etc/passwd' });

    expect(result).toContain('Refused');
    expect(result).toContain('file:');
  });
});
