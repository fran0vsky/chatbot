import { Controller, Get } from '@nestjs/common';
import { DinoSummary } from '@org/shared-types';
import { DINOS, toDinoSummary } from './dinos';

@Controller('dinos')
export class DinosController {
  @Get()
  list(): DinoSummary[] {
    return DINOS.map(toDinoSummary);
  }
}
