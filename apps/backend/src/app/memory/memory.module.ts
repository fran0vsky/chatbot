import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { SkillsController } from './skills.controller';

// DatabaseModule is @Global, so DATABASE_CONNECTION is available here without
// importing it explicitly. MemoryService is exported for AgentsModule to inject.
@Module({
  controllers: [SkillsController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
