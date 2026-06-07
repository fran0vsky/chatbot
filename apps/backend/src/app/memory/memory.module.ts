import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { SkillsController } from './skills.controller';
import { MemoryCreatorController } from './memory-creator.controller';
import { MemoryCreatorService } from './memory-creator.service';

// DatabaseModule is @Global, so DATABASE_CONNECTION is available here without
// importing it explicitly. MemoryService is exported for AgentsModule to inject.
// MemoryCreatorService is module-local (consumed only by MemoryCreatorController).
@Module({
  controllers: [SkillsController, MemoryCreatorController],
  providers: [MemoryService, MemoryCreatorService],
  exports: [MemoryService],
})
export class MemoryModule {}
