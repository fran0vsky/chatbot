import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CreateCustomDinoRequest,
  CuratedModel,
  CustomDino,
  UpdateCustomDinoRequest,
} from '@org/shared-types';
import { MODEL_CATALOGUE } from './model-catalogue';
import { CustomDinoService } from './custom-dinos.service';

/**
 * Thin REST controller for user-authored custom dinos.
 * All business logic and validation lives in CustomDinoService.
 *
 * Routes (all prefixed with /api via global prefix):
 *   POST   /custom-dinos           — create
 *   GET    /custom-dinos?userId=   — list by userId
 *   PUT    /custom-dinos/:id       — update
 *   DELETE /custom-dinos/:id?userId=  — delete
 *   GET    /models                 — curated model catalogue
 */
@Controller()
export class CustomDinosController {
  constructor(private readonly customDinoService: CustomDinoService) {}

  @Post('custom-dinos')
  create(@Body() body: CreateCustomDinoRequest): Promise<CustomDino | null> {
    return this.customDinoService.create(body);
  }

  @Get('custom-dinos')
  list(@Query('userId') userId: string): Promise<CustomDino[]> {
    return this.customDinoService.list(userId);
  }

  @Put('custom-dinos/:id')
  update(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() body: UpdateCustomDinoRequest,
  ): Promise<CustomDino | null> {
    return this.customDinoService.update(id, userId, body);
  }

  @Delete('custom-dinos/:id')
  delete(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<void> {
    return this.customDinoService.delete(id, userId);
  }

  @Get('models')
  getModels(): CuratedModel[] {
    return MODEL_CATALOGUE;
  }
}
