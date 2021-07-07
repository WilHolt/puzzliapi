import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
// import * as moment from 'moment-duration-format';

const moment = require('moment');

const momentDurationFormatSetup = require('moment-duration-format');

const api = axios.create({
  baseURL: 'https://api.github.com',
});
const { google } = require('googleapis');

const youtube = google.youtube({
  version: 'v3',
  auth: 'AIzaSyCao-rJjVRDwfmbK5z6YvS0yex3IdvldxE', // specify your API key here
});

function getVideoDetails(id) {
  let musicDetails;
  return api
    .get(
      `https://www.googleapis.com/youtube/v3/videos?id=${id}&key=AIzaSyCao-rJjVRDwfmbK5z6YvS0yex3IdvldxE&part=id,snippet,contentDetails,localizations`,
    )
    .then((ev) => {
      const item = ev.data.items[0];
      // console.log(
      //   convertYouTubeDuration(ev.data.items[0].contentDetails.duration),
      // );
      musicDetails = {
        title: item.snippet.title,
        creator: item.snippet.channelTitle,
        duration: convertYouTubeDuration(
          ev.data.items[0].contentDetails.duration,
        ),
        thumbnail: item.snippet.thumbnails.high,
      };
      return musicDetails;
    });
}

const convertYouTubeDuration = function (yt_duration) {
  return moment.duration(yt_duration).format('h:mm:ss').padStart(4, '0:0');
};

import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface Music {
  title: string;
  thumbnail: {
    url: string;
    width: number;
    height: number;
  };
  channelTitle: string;
  url: string;
}

export interface Room {
  roomid: string;
  roomowner?: {
    id: string;
  };
  playing?: string;
  users: any[];
  playlist?: Music[];
  musicowner?: {
    id: string;
  };
  nowPlaying?: {
    currentTime: number;
  };
}

const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
const TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart.json';
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

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const index = this.store.findIndex((room) =>
      room.users.some((user) => user.id == client.id),
    );
    const store = this.store[index];
    const userIndex = store.users.findIndex((user) => user.id == client.id);
    store.users = [
      ...store.users.slice(0, userIndex),
      ...store.users.slice(userIndex + 1),
    ];
    this.server.to(store.roomid).emit('userDisconnectedServer', store);

    console.log(client.id, store.users);
  }
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): string {
    // console.log(payload);
    return 'Hello world!';
  }

  @SubscribeMessage('createRoom')
  createRoom(client: Socket, payload: any): any {
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
        playlist: [],
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
    client.join(payload.roomid, (event) => {
      const storedRoom = this.store.find(
        (room) => room.roomid == payload.roomid,
      );
      if (storedRoom) {
        axios.get('http://names.drycodes.com/1').then((res) => {
          const user = {
            id: client.id,
            nickname: res.data[0],
          };
          storedRoom.users.push(user);
          console.log('rodou')
          this.server.to(client.id).emit('connectedRoom', {
            room: storedRoom ? storedRoom : null,
            user,
            clientid: client.id,
          });

          this.server.to(storedRoom.roomid).emit('connectedRoomServer', {
            room: storedRoom ? storedRoom : null,
            user,
            clientid: client.id,
          });
        });
      }

      console.log(client.rooms)
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
      storedRoom.musicowner = {
        id: client.id,
      };
      storedRoom.nowPlaying = {
        currentTime: 0,
      };

      const index = storedRoom.playlist.findIndex(
        (music: Music) => music.url == payload.videourl,
      );
      storedRoom.playlist = [
        ...storedRoom.playlist.slice(0, index),
        ...storedRoom.playlist.slice(index + 1),
      ];
    }
    this.server.to(payload.roomid).emit('videoLoaded', storedRoom);
    return 'Hello world!';
  }

  @SubscribeMessage('addQueue')
  async addQueue(client: Socket, payload: any) {
    const storedRoom = this._getStoredRoomRef(payload.roomid);
    if (storedRoom) {
      const music = await getVideoDetails(payload.videoid);
      storedRoom.playlist.push({ ...music, url: payload.videourl });
      this.server.to(payload.roomid).emit('videoQueued', storedRoom.playlist);
    }
    return 'Hello world!';
  }

  @SubscribeMessage('nextVideo')
  nextVideo(client: Socket, payload: any) {
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playing = payload.videourl;
      storedRoom.musicowner = {
        id: client.id,
      };
      storedRoom.nowPlaying = {
        currentTime: 0,
      };

      const index = storedRoom.playlist.findIndex(
        (music: Music) => music.url == payload.videourl,
      );
      storedRoom.playlist = [
        ...storedRoom.playlist.slice(0, index),
        ...storedRoom.playlist.slice(index + 1),
      ];
    }
    this.server.to(payload.roomid).emit('videoLoaded', storedRoom);
  }

  @SubscribeMessage('removeQueue')
  async removeQueue(client: Socket, payload: any) {
    const storedRoom = this._getStoredRoomRef(payload.roomid);

    if (storedRoom) {
      const index = storedRoom.playlist.findIndex(
        (music: Music) => music.title == payload.title,
      );
      storedRoom.playlist = [
        ...storedRoom.playlist.slice(0, index),
        ...storedRoom.playlist.slice(index + 1),
      ];
      this.server.to(payload.roomid).emit('videoRemoved', storedRoom.playlist);
    }
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
      const room = this._getStoredRoomRef(payload.roomid);
      if (room.nowPlaying) {
        room.nowPlaying.currentTime = payload.currentTime;
      } else {
        room.nowPlaying = {
          currentTime: payload.currentTime,
        };
      }
      this.server.to(payload.roomid).emit('videoUpdated', {
        type: payload.type,
        currentTime: payload.currentTime,
      });
    }
    return 'Hello world!';
  }

  @SubscribeMessage('clearPlaylist')
  clearPlaylist(client: Socket, payload: any): any {
    console.log('clear');
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    storedRoom.playlist = [];
    storedRoom.playing = '';
    console.log('clear', storedRoom);
  }

  _getStoredRoomRef(id) {
    return this.store.find((room) => room.roomid == id);
  }

  _getIdFromUrl(videoUrl) {
    const getEntireIdQueryRegex = /(v)([\=])([\w\d_-]+)([\?\&])?/g;
    const cleanQueryRulesRegex = /(?:v=|&)/g;
    return videoUrl
      .match(getEntireIdQueryRegex)[0]
      .replace(cleanQueryRulesRegex, '');
  }
}
