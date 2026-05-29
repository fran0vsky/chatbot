import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { DinosController } from './dinos.controller';

@Module({
  controllers: [AgentsController, DinosController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
