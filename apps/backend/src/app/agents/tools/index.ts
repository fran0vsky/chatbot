import { getCurrentTimeTool } from './get-current-time.tool';
import { webSearchTool } from './web-search.tool';
import { fetchPageTool } from './fetch-page.tool';

export const tools = [getCurrentTimeTool, webSearchTool, fetchPageTool] as const;
