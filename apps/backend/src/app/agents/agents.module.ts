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
import { ReactivityController } from './reactivity.controller';
import { ReactivityService } from './reactivity.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  controllers: [AgentsController, DinosController, GroupAgentsController, CustomDinosController, AvatarController, ReactivityController],
  providers: [AgentsService, GroupAgentsService, CustomDinoService, AvatarService, ReactivityService],
  // ReactivityService exported so GroupAgentsService can inject it after constructor injection.
  exports: [AgentsService, ReactivityService],
})
export class AgentsModule {}
