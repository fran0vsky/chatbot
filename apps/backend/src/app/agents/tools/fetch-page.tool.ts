import { tool } from '@langchain/core/tools';
import { load } from 'cheerio';
import { z } from 'zod';

const MAX_TEXT_LEN = 5000;
const MAX_BYTES = 2_500_000;

/** Collapse runs of whitespace to a single space and trim. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Extract structured main content from an HTML string using Cheerio. */
function extractMainContent(html: string): string {
  const $ = load(html);

  // Remove chrome elements that don't contain main content
  $('script, style, noscript, nav, footer, aside, header, form, svg').remove();

  // Get title
  const titleText = collapseWhitespace($('title').first().text());

  // Determine content root: prefer article, main, [role=main], else largest text block
  let $root = $('article').first();
  if (!$root.length) $root = $('main').first();
  if (!$root.length) $root = $('[role=main]').first();

  if (!$root.length) {
    // Fallback: pick the direct child of <body> with the largest text length
    let maxLen = 0;
    $('body > *').each((_i, el) => {
      const len = $(el).text().length;
      if (len > maxLen) {
        maxLen = len;
        $root = $(el);
      }
    });
  }

  if (!$root.length) $root = $('body');

  // Walk content root in document order, collecting headings + paragraphs
  const lines: string[] = [];

  if (titleText) {
    lines.push(`Title: ${titleText}`);
  }

  $root.find('h1,h2,h3,h4,h5,h6,p,li').each((_i, el) => {
    const tag = el.tagName.toLowerCase();
    const text = collapseWhitespace($(el).text());
    if (!text) return;

    if (tag.startsWith('h')) {
      lines.push(`\n${text}`);
    } else {
      lines.push(text);
    }
  });

  const assembled = lines.join('\n').trim();
  return assembled;
}

export const fetchPageTool = tool(
  async ({ url }: { url: string }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return `Refused: only http/https URLs are allowed (got ${parsed.protocol}).`;
      }

      const res = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': 'DinoAgents/1.0 (+https://github.com/fran0vsky/chatbot)',
          Accept: 'text/html,application/xhtml+xml,text/*;q=0.9',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return `Fetch failed: HTTP ${res.status} for ${url}`;

      const contentType = res.headers.get('content-type') ?? '';

      // Refuse binary content types without reading the body
      if (
        !contentType.includes('html') &&
        !contentType.startsWith('text/') &&
        !contentType.includes('json')
      ) {
        const type = contentType || 'unknown';
        return `Unsupported content type: ${type}`;
      }

      // Check Content-Length header before reading
      const contentLengthHeader = res.headers.get('content-length');
      if (contentLengthHeader !== null) {
        const declaredBytes = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredBytes) && declaredBytes > MAX_BYTES) {
          return `Fetch failed: response too large (${declaredBytes} bytes, max ${MAX_BYTES}).`;
        }
      }

      const raw = await res.text();

      // Check actual read length
      if (raw.length > MAX_BYTES) {
        return `Fetch failed: response too large (${raw.length} bytes, max ${MAX_BYTES}).`;
      }

      // Non-HTML text / JSON: return cleaned raw text capped at MAX_TEXT_LEN
      if (!contentType.includes('html')) {
        const cleaned = collapseWhitespace(raw);
        const truncated =
          cleaned.length > MAX_TEXT_LEN
            ? cleaned.slice(0, MAX_TEXT_LEN) + '…'
            : cleaned;
        return truncated;
      }

      // HTML branch: Cheerio extraction
      const extracted = extractMainContent(raw);

      // Soft-fallback: if extraction is empty, use whole body text
      if (!extracted.trim()) {
        const $ = load(raw);
        $('script, style, noscript, nav, footer, aside, header, form, svg').remove();
        const bodyText = collapseWhitespace($('body').text());
        if (!bodyText) {
          return 'Could not extract readable content from this page.';
        }
        const truncated =
          bodyText.length > MAX_TEXT_LEN
            ? bodyText.slice(0, MAX_TEXT_LEN) + '…'
            : bodyText;
        return truncated;
      }

      const truncated =
        extracted.length > MAX_TEXT_LEN
          ? extracted.slice(0, MAX_TEXT_LEN) + '…'
          : extracted;
      return truncated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Fetch failed: ${msg}`;
    }
  },
  {
    name: 'fetch_page',
    description:
      'Fetches a web page by URL and extracts its main content (title, headings, and body text) ' +
      'up to ~5KB. Handles HTML pages with structured extraction; refuses binary files; ' +
      'passes through plain text and JSON. Use this when the user asks you to read, summarise, ' +
      'or extract information from a specific webpage URL.',
    schema: z.object({
      url: z.string().url().describe('Absolute http/https URL of the page to fetch'),
    }),
  },
);
