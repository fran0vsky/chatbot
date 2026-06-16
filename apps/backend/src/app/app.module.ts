import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { ArenaModule } from './arena/arena.module';
import { AssistantModule } from './assistant/assistant.module';
import { DatabaseModule } from './database/database.module';
import { MemoryModule } from './memory/memory.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DatabaseModule, MemoryModule, AgentsModule, ArenaModule, AssistantModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
