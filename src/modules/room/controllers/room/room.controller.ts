import { Controller, Get } from '@nestjs/common';

@Controller('room')
export class RoomController {
  @Get('create')
  createRoom() {
    return `create room`;
  }

  @Get()
  findAll(): string {
    return 'This action returns all cats';
  }
}
