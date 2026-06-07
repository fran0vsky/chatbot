import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  SaveCreatedSkillRequest,
  SaveCreatedSkillResponse,
  SuggestSkillsRequest,
  SuggestSkillsResponse,
  SynthesizeSkillRequest,
  SynthesizedSkill,
} from '@org/shared-types';
import { MemoryCreatorService } from './memory-creator.service';

/**
 * REST surface for the AI Memory Creator (Phase 34), scoped by the anonymous
 * (userId × dinoId). HTTP only — every decision lives in MemoryCreatorService.
 * Routes sit under the global `api` prefix and do not collide with SkillsController's
 * /api/skills (POST) or /api/skills/:id (PUT/DELETE).
 */
@Controller()
export class MemoryCreatorController {
  constructor(private readonly creator: MemoryCreatorService) {}

  @Post('skills/suggest')
  async suggest(@Body() body: SuggestSkillsRequest): Promise<SuggestSkillsResponse> {
    const { userId, dinoId, history } = body;
    if (!userId || !dinoId) {
      throw new BadRequestException('userId and dinoId are required');
    }
    const suggestions = await this.creator.suggest(userId, dinoId, history ?? []);
    return { suggestions };
  }

  @Post('skills/synthesize')
  async synthesize(@Body() body: SynthesizeSkillRequest): Promise<SynthesizedSkill> {
    const { userId, dinoId, input } = body;
    if (!userId || !dinoId || !input?.trim()) {
      throw new BadRequestException('userId, dinoId and input are required');
    }
    return this.creator.synthesize(userId, dinoId, input);
  }

  @Post('skills/save')
  async save(@Body() body: SaveCreatedSkillRequest): Promise<SaveCreatedSkillResponse> {
    const { userId, dinoId, title, instruction, whenToActivate } = body;
    if (!userId || !dinoId || !title?.trim() || !instruction?.trim()) {
      throw new BadRequestException('userId, dinoId, title and instruction are required');
    }
    return this.creator.reconcileAndSave(userId, dinoId, { title, whenToActivate, instruction });
  }
}
