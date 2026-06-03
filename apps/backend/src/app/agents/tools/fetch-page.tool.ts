import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const MAX_TEXT_LEN = 5000;

// Strip HTML tags and decode common entities so the model gets plain text it
// can summarise without choking on markup tokens.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return `Fetch failed: HTTP ${res.status} for ${url}`;
      const contentType = res.headers.get('content-type') ?? '';
      const raw = await res.text();
      const text = contentType.includes('html') ? htmlToText(raw) : raw;
      const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const truncated = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN) + '…' : text;
      return title ? `Title: ${title}\n\n${truncated}` : truncated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Fetch failed: ${msg}`;
    }
  },
  {
    name: 'fetch_page',
    description:
      'Fetches a web page by URL and returns its plain-text content (up to ~5KB). ' +
      'Use this when the user asks you to read, summarise, or extract information from a specific webpage URL.',
    schema: z.object({
      url: z.string().url().describe('Absolute http/https URL of the page to fetch'),
    }),
  },
);
