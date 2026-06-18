import { Controller, Get, Query } from '@nestjs/common';
import { DinoSummary } from '@org/shared-types';
import { DINOS, toDinoSummary } from './dinos';
import { CustomDinoService } from './custom-dinos.service';

@Controller('dinos')
export class DinosController {
  constructor(private readonly customDinoService: CustomDinoService) {}

  /** Return built-in dino summaries. When `userId` is supplied, the user's
   *  custom dinos are appended (projected — systemPrompt never included). */
  @Get()
  async list(@Query('userId') userId?: string): Promise<DinoSummary[]> {
    const builtIns: DinoSummary[] = DINOS.map(toDinoSummary);
    if (!userId) return builtIns;

    const customSummaries = await this.customDinoService.listSummaries(userId);
    return [...builtIns, ...customSummaries];
  }
}
