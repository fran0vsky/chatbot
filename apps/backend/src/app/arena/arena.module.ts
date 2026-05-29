import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaController } from './arena.controller';

// DatabaseModule is @Global — DATABASE_CONNECTION is available without explicit import.
@Module({
  controllers: [ArenaController],
  providers: [ArenaService],
})
export class ArenaModule {}
