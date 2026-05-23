import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const getCurrentTimeTool = tool(
  async () => {
    const now = new Date();
    const iso = now.toISOString().split('.')[0] + 'Z';
    const human =
      now.toISOString().slice(0, 10) +
      ' ' +
      now.toISOString().slice(11, 16) +
      ' UTC';
    return `${iso} (${human})`;
  },
  {
    name: 'get_current_time',
    description:
      "Returns the current date and time in UTC. Use this when the user asks for the current time, today's date, or anything time-relative.",
    schema: z.object({}),
  },
);
