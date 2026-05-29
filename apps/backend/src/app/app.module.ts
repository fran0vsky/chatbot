import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { DatabaseModule } from './database/database.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [DatabaseModule, MemoryModule, AgentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
