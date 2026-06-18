import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { CustomDinosController } from './custom-dinos.controller';
import { CustomDinoService } from './custom-dinos.service';
import { DinosController } from './dinos.controller';
import { GroupAgentsController } from './group-agents.controller';
import { GroupAgentsService } from './group-agents.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  controllers: [AgentsController, DinosController, GroupAgentsController, CustomDinosController, AvatarController],
  providers: [AgentsService, GroupAgentsService, CustomDinoService, AvatarService],
  exports: [AgentsService],
})
export class AgentsModule {}
