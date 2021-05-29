import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface Room {
  roomid: string;
  playing?: string;
  users: any[];
  playlist?: any;
}
@WebSocketGateway()
export class GatewayGateway {
  private logger: Logger = new Logger('GatewayGateway');
  store: Room[] = [];
  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log(' WebSocket Initialized');
    // console.log(' WebSocket Initialized');
  }

  handleConnection(@ConnectedSocket() client: any, ...args: any[]) {
    this.logger.log(' Connected', client.id);
    // console.log(args);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): string {
    // console.log(payload);
    return 'Hello world!';
  }

  @SubscribeMessage('createRoom')
  createRoom(client: Socket, payload: any): any {
    console.log(`MEU ROOM ID RECEBIDO`, payload);
    client.join(payload.id, (socket) => {
      console.log(socket);
      console.log(client.rooms);
      console.log(Object.values(client.rooms));
      const createdRoom = Object.values(client.rooms)[1];
      this.store.push({
        roomid: createdRoom,
        users: [client.client.id],
      });

      console.log(this.store);
      // client.emit('createdRoom', createdRoom);
      // console.log(createdRoom);
      this.server.to(createdRoom).emit('createdRoom', 'connected');
      this.server.to(createdRoom).emit('createdRoom', createdRoom);
      this.server.to(createdRoom).emit('createdRoom', client.id);
      // client.emit('createdRoom', createdRoom);
    });
    const createdRoom = Object.values(client.rooms)[1];
    return createdRoom;
  }

  @SubscribeMessage('connectRoom')
  connectRoom(client: Socket, payload: any): string {
    client.join(payload.roomid, (event) => {
      console.log(`conector`, event);
      console.log(payload);
      console.log(client.rooms);
      console.log(this.store);
      const storedRoom = this.store.find(
        (room) => room.roomid == payload.roomid,
      );
      if (storedRoom) {
        storedRoom.users.push(client.id);
      }
      console.log(this.store);
      this.server.to(client.id).emit('connectedRoom', {
        nowPlaying: storedRoom ? storedRoom.playing : null,
      });
    });

    return 'Hello world!';
  }

  @SubscribeMessage('updateVideoState')
  observeVideoPlaying(client: Socket, payload: any): string {
    this.server.emit('videoStateUpdated', payload.timecode);
    return 'Hello world!';
  }

  @SubscribeMessage('loadVideo')
  loadVideo(client: Socket, payload: any): string {
    console.log('laodVideo', payload);
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playing = payload.videourl;
    }
    this.server.to(payload.roomid).emit('videoLoaded', payload.videourl);
    return 'Hello world!';
  }

  @SubscribeMessage('updateVideo')
  updateVideo(client: Socket, payload: any): string {
    console.log(`recebi me upayload`, payload);
    if (payload.type !== 10) {
      this.server.to(payload.roomid).emit('videoUpdated', {
        type: payload.type,
        currentTime: payload.currentTime,
      });
    } else {
      this.server.to(payload.roomid).emit('videoUpdated', {
        type: payload.type,
        currentTime: payload.currentTime,
      });
    }
    return 'Hello world!';
  }
}
