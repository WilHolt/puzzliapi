import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RoomModule } from './room/room.module';
import { PlaylistModule } from './playlist/playlist.module';

@Module({
  imports: [AuthModule, RoomModule, PlaylistModule],
})
export class ModulesModule {}
