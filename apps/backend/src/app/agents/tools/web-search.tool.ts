import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface DdgRelatedTopic {
  Text?: string;
  Topics?: DdgRelatedTopic[];
}

interface DdgResponse {
  AbstractText?: string;
  RelatedTopics?: DdgRelatedTopic[];
}

const MAX_LEN = 600;

function flattenTopics(topics: DdgRelatedTopic[] | undefined, out: string[]): void {
  if (!topics) return;
  for (const t of topics) {
    if (out.length >= 3) return;
    if (t.Text) {
      out.push(t.Text);
    } else if (t.Topics) {
      flattenTopics(t.Topics, out);
    }
  }
}

export const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'chatbot-web-search/1.0' },
      });
      if (!res.ok) return `Search failed: HTTP ${res.status}`;
      const data = (await res.json()) as DdgResponse;
      const lines: string[] = [];
      if (data.AbstractText) lines.push(data.AbstractText);
      const related: string[] = [];
      flattenTopics(data.RelatedTopics, related);
      lines.push(...related);
      if (lines.length === 0) return `No results found for: ${query}`;
      const body = lines.length > 1 ? `• ${lines.join('\n• ')}` : lines[0];
      return body.length > MAX_LEN ? body.slice(0, MAX_LEN - 1) + '…' : body;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Search failed: ${msg}`;
    }
  },
  {
    name: 'web_search',
    description:
      'Searches the web for fresh, factual information. Use this when the user asks about current events, recent news, or anything that may have changed after your training cutoff.',
    schema: z.object({
      query: z.string().min(1).max(200).describe('The search query'),
    }),
  },
);
