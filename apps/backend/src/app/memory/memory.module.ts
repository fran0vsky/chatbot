import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';

// DatabaseModule is @Global, so DATABASE_CONNECTION is available here without
// importing it explicitly. MemoryService is exported for AgentsModule to inject.
@Module({
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
