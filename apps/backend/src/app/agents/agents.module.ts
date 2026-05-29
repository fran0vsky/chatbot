import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { DinosController } from './dinos.controller';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  controllers: [AgentsController, DinosController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
