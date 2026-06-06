import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DinoSkill, LearnedItems } from '@org/shared-types';
import { MemoryService } from './memory.service';

interface CreateSkillBody {
  userId?: string;
  dinoId?: string;
  title?: string;
  instruction?: string;
  whenToActivate?: string;
}

interface UpdateSkillBody {
  title?: string;
  instruction?: string;
  whenToActivate?: string;
}

/**
 * REST surface for taught skills + learned memories, all scoped by the anonymous
 * (userId × dinoId). HTTP only — every decision lives in MemoryService. Routes sit
 * under the global `api` prefix: /api/skills, /api/memories/:id.
 */
@Controller()
export class SkillsController {
  constructor(private readonly memory: MemoryService) {}

  @Get('skills')
  async list(
    @Query('userId') userId: string,
    @Query('dinoId') dinoId: string,
  ): Promise<LearnedItems> {
    if (!userId || !dinoId) {
      throw new BadRequestException('userId and dinoId are required');
    }
    const [skills, memories] = await Promise.all([
      this.memory.getSkills(userId, dinoId),
      this.memory.listMemories(userId, dinoId),
    ]);
    return { skills, memories: memories.map((m) => ({ id: m.id, content: m.content })) };
  }

  @Post('skills')
  @HttpCode(201)
  async create(@Body() body: CreateSkillBody): Promise<DinoSkill> {
    const { userId, dinoId, title, instruction, whenToActivate } = body;
    if (!userId || !dinoId || !title?.trim() || !instruction?.trim()) {
      throw new BadRequestException('userId, dinoId, title and instruction are required');
    }
    const created = await this.memory.addSkill(userId, dinoId, title, instruction, whenToActivate);
    if (!created) {
      throw new ServiceUnavailableException('Could not persist skill (database unavailable)');
    }
    return created;
  }

  @Put('skills/:id')
  async update(@Param('id') id: string, @Body() body: UpdateSkillBody): Promise<DinoSkill> {
    const { title, instruction, whenToActivate } = body;
    if (!title?.trim() || !instruction?.trim()) {
      throw new BadRequestException('title and instruction are required');
    }
    const updated = await this.memory.updateSkill(id, { title, instruction, whenToActivate });
    if (!updated) {
      throw new ServiceUnavailableException('Could not update skill (database unavailable)');
    }
    return updated;
  }

  @Delete('skills/:id')
  @HttpCode(204)
  async removeSkill(@Param('id') id: string): Promise<void> {
    await this.memory.deleteSkill(id);
  }

  @Delete('memories/:id')
  @HttpCode(204)
  async removeMemory(@Param('id') id: string): Promise<void> {
    await this.memory.deleteMemory(id);
  }
}
