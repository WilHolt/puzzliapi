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
  roomowner?: {
    id: string;
  };
  playing?: string;
  users: any[];
  playlist?: any;
  musicowner?: {
    id: string;
  };
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
    client.join(payload.id, () => {
      const createdRoom = payload.id;

      this.store.push({
        roomid: payload.id,
        users: [client.client.id],
        musicowner: {
          id: client.id,
        },
        roomowner: {
          id: client.id,
        },
      });
      const storedRoomd = this._getStoredRoomRef(payload.id);
      // this.server.to(createdRoom).emit('createdRoom', 'connected');
      this.server.to(createdRoom).emit('createdRoom', storedRoomd);
      // this.server.to(createdRoom).emit('createdRoom', client.id);
    });
    return payload.id;
  }

  @SubscribeMessage('connectRoom')
  connectRoom(client: Socket, payload: any): string {
    console.log('1', this.store);

    client.join(payload.roomid, (event) => {
      const storedRoom = this.store.find(
        (room) => room.roomid == payload.roomid,
      );
      console.log(this.store);

      if (storedRoom) {
        storedRoom.users.push(client.id);
      }
      this.server.to(client.id).emit('connectedRoom', {
        room: storedRoom ? storedRoom : null,
        clientid: client.id,
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
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playing = payload.videourl;
    }
    storedRoom.musicowner.id = client.id;
    this.server.to(payload.roomid).emit('videoLoaded', storedRoom);
    return 'Hello world!';
  }

  @SubscribeMessage('updateVideo')
  updateVideo(client: Socket, payload: any): string {
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

  _getStoredRoomRef(id) {
    return this.store.find((room) => room.roomid == id);
  }
}
