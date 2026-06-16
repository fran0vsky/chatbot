import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  tools: {
    web_search: boolean;
  };
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    const key = process.env['TAVILY_API_KEY'];
    const webSearch = typeof key === 'string' && key.length > 0;
    return { status: 'ok', tools: { web_search: webSearch } };
  }
}
