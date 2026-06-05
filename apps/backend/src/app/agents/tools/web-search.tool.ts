import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

const SNIPPET_LEN = 200;

export const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    const apiKey = process.env['TAVILY_API_KEY'];
    if (!apiKey) {
      return 'Search unavailable: TAVILY_API_KEY is not configured.';
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'DinoAgents/1.0',
        },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          topic: 'general',
          max_results: 5,
        }),
      });

      if (res.status === 429) {
        return 'Search rate-limited: the search provider is over quota, try again later.';
      }

      if (!res.ok) {
        return `Search failed: HTTP ${res.status} from search provider.`;
      }

      const data = (await res.json()) as unknown as TavilyResponse;
      const results = data.results ?? [];

      if (results.length === 0) {
        return `No results found for: ${query}`;
      }

      const formatted = results.slice(0, 5).map((r, i) => {
        const title = r.title ?? '(no title)';
        const raw = r.content ?? '';
        const snippet = raw.length > SNIPPET_LEN ? raw.slice(0, SNIPPET_LEN - 1) + '…' : raw;
        const url = r.url ?? '';
        return `${i + 1}. ${title}\n${snippet}\n${url}`;
      });

      return formatted.join('\n\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Search failed: ${msg}`;
    }
  },
  {
    name: 'web_search',
    description:
      'Searches the web for fresh, factual information and returns the top results with titles, ' +
      'content snippets, and source URLs. Use this when the user asks about current events, recent ' +
      'news, or anything that may have changed after your training cutoff. The returned source URLs ' +
      'can be passed to fetch_page for deeper reading of a specific article.',
    schema: z.object({
      query: z.string().min(1).max(200).describe('The search query'),
    }),
  },
);
