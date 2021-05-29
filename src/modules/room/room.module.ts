import { Module } from '@nestjs/common';
import { RoomController } from './controllers/room/room.controller';
import { GatewayGateway } from './gateway.gateway';

@Module({
  controllers: [RoomController],
  providers: [GatewayGateway],
})
export class RoomModule {}
