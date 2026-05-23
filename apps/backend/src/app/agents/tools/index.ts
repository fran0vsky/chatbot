import { getCurrentTimeTool } from './get-current-time.tool';
import { webSearchTool } from './web-search.tool';

export const tools = [getCurrentTimeTool, webSearchTool] as const;
