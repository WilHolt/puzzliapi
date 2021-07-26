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

function getVideoDetails(id, user) {
  let musicDetails;
  return api
    .get(
      `https://www.googleapis.com/youtube/v3/videos?id=${id}&key=AIzaSyCao-rJjVRDwfmbK5z6YvS0yex3IdvldxE&part=id,snippet,contentDetails,localizations`,
    )
    .then((ev) => {
      const item = ev.data.items[0];
      musicDetails = {
        id: item.id,
        title: item.snippet.title,
        creator: item.snippet.channelTitle,
        duration: convertYouTubeDuration(
          ev.data.items[0].contentDetails.duration,
        ),
        thumbnail: item.snippet.thumbnails.high,
        requester: user,
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
  id?: string;
  videourl?: string;
  thumbnail: {
    url: string;
    width: number;
    height: number;
  };
  channelTitle: string;
  url: string;
  requester?: any;
}

export interface Room {
  roomid: string;
  roomowner?: string;
  playing?: string;
  users: any[];
  playlist?: Music[];
  nowPlaying?: {
    music?: Music;
    timecode?: number;
    lasttimecode?: number;
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
  }

  handleConnection(@ConnectedSocket() client: any, ...args: any[]) {
    this.logger.log(' Connected', client.id);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const index = this.store.findIndex(
      (room) =>
        room && room.users && room.users.some((user) => user.id == client.id),
    );
    const store = this.store[index];
    if (store != undefined) {
      const userIndex = store.users.findIndex((user) => user.id == client.id);
      store.users = [
        ...store.users.slice(0, userIndex),
        ...store.users.slice(userIndex + 1),
      ];
      this.server.to(store.roomid).emit('userDisconnectedServer', store);
    }
  }
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): string {
    return 'Hello world!';
  }

  @SubscribeMessage('createRoom')
  createRoom(client: Socket, payload: any): any {
    client.join(payload.id, () => {
      const createdRoom = payload.id;
      // axios.get('http://names.drycodes.com/1').then((res) => {
      const user = {
        id: client.id,
        nickname: 'res.data[0]',

      };
      // nickname: 'res.data[0]',

      this.store.push({
        roomid: payload.id,
        users: [user],
        roomowner: user.id,
        playlist: [],
        nowPlaying: {
          lasttimecode: 0,
        },
      });
      const storedRoom = this._getStoredRoomRef(payload.id);
      this.server
        .to(storedRoom.roomid)
        .emit('createdRoom', { room: storedRoom, user });
      // });
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
        const user = {
          id: client.id,
          nickname: uuidv4(),
        };

        storedRoom.users.push(user);

        this.server.to(user.id).emit('connectedRoom', {
          room: storedRoom ? storedRoom : null,
          user,
        });

        this.server.to(storedRoom.roomid).emit('connectedRoomServer', {
          room: storedRoom ? storedRoom : null,
          user,
        });
      }
    });

    return 'Hello world!';
  }
  @SubscribeMessage('updateVideoState')
  observeVideoPlaying(
    client: Socket,
    payload: { roomid: string; timecode?: number; type?: number },
  ): string {
    const { timecode, roomid, type } = payload;
    const storedRoom = this._getStoredRoomRef(roomid);
    if (storedRoom) {
      // console.log(
      //   '----timecode: ',
      //   timecode,
      //   '----lasttimecode:',
      //   storedRoom.nowPlaying.lasttimecode,
      // );
      console.log(payload);

      const lasttimecode = storedRoom.nowPlaying.lasttimecode;
      const isTimecodeAdvanced = timecode > lasttimecode;
      const isTimecodeReturned = (timecode - lasttimecode) < 0;
      const isPaused = type == 2;
      if (isTimecodeAdvanced || isTimecodeReturned || isPaused) {
        console.log(payload);
        const event = { type, value: timecode };
        this.server.to(payload.roomid).emit('videoStateUpdated', event);
        storedRoom.nowPlaying.lasttimecode = timecode;
      }
    }

    return 'Hello world!';
  }

  @SubscribeMessage('loadVideo')
  loadVideo(client: Socket, payload: any): string {
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playing = payload.videourl;
      storedRoom.nowPlaying = {
        music: payload.music,
        timecode: 0,
        lasttimecode: 0,
      };
      const index = storedRoom.playlist.findIndex(
        (music: Music) => music.id == payload.music.id,
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
      const user = storedRoom.users.find((user) => user.id == client.id);
      const music = await getVideoDetails(payload.videoid, user);
      // eslint-disable-next-line prettier/prettier
      if (storedRoom.playlist.length == 0 && storedRoom.nowPlaying.music == undefined) {
        this.loadVideo(client, { ...payload, music });
      } else {
        storedRoom.playlist.push({ ...music, url: payload.videourl });
      }
      this.server.to(payload.roomid).emit('videoQueued', storedRoom.playlist);
    }
    return 'Hello world!';
  }

  @SubscribeMessage('nextVideo')
  nextVideo(client: Socket, payload: any) {
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playing = payload.videourl;
      storedRoom.nowPlaying = {
        timecode: 0,
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

  @SubscribeMessage('changeVideoPosition')
  changeVideoPosition(client: Socket, payload: any) {
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    if (storedRoom) {
      storedRoom.playlist = payload.playlist;
    }
    this.server.to(payload.roomid).emit('playlistChanged', storedRoom.playlist);
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

  // @SubscribeMessage('updateVideo')
  // updateVideo(client: Socket, payload: any): string {
  //   if (payload.type !== 10) {
  //     this.server.to(payload.roomid).emit('videoUpdated', {
  //       type: payload.type,
  //       currentTime: payload.currentTime,
  //     });
  //   } else {
  //     const room = this._getStoredRoomRef(payload.roomid);
  //     if (room.nowPlaying) {
  //       room.nowPlaying.timecode = payload.currentTime;
  //     } else {
  //       room.nowPlaying = {
  //         timecode: payload.currentTime,
  //       };
  //     }
  //     this.server.to(payload.roomid).emit('videoUpdated', {
  //       type: payload.type,
  //       currentTime: payload.currentTime,
  //     });
  //   }
  //   return 'Hello world!';
  // }

  @SubscribeMessage('clearPlaylist')
  clearPlaylist(client: Socket, payload: any): any {
    const storedRoom = this.store.find((room) => room.roomid == payload.roomid);
    storedRoom.playlist = [];
    storedRoom.playing = '';
  }

  @SubscribeMessage('skipVideo')
  skipVideo(client: Socket, payload: any): any {
    const storedRoom = this._getStoredRoomRef(payload.roomid);
    if (storedRoom) {
      this.loadVideo(client, {
        roomid: payload.roomid,
        music: storedRoom.playlist[0],
      });
    }
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
