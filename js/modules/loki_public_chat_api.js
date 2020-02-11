/* global log, window, process */
const EventEmitter = require('events');
const nodeFetch = require('node-fetch');
const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

class LokiPublicChatFactoryAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
    this.allMembers = [];
    // Multidevice states
    this.primaryUserProfileName = {};
  }

  // MessageReceiver.connect calls this
  // start polling in all existing registered channels
  async open() {
    await Promise.all(this.servers.map(server => server.open()));
  }

  // MessageReceiver.close
  async close() {
    await Promise.all(this.servers.map(server => server.close()));
  }

  static async validServer(serverUrl) {
    // test to make sure it's online (and maybe has a valid SSL cert)
    try {
      // allow .loki (may only need an agent but not sure
      //              until we have a .loki to test with)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = serverUrl.match(/\.loki\//)
        ? 0
        : 1;
      await nodeFetch(serverUrl);
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
      // const txt = await res.text();
    } catch (e) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
      log.warn(`failing to created ${serverUrl}`, e.code, e.message);
      // bail out if not valid enough
      return false;
    }
    return true;
  }

  // server getter/factory
  async findOrCreateServer(serverUrl) {
    let thisServer = this.servers.find(
      server => server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      log.info(`LokiAppDotNetAPI creating ${serverUrl}`);

      if (!await this.constructor.validServer(serverUrl)) {
        return null;
      }

      // after verification then we can start up all the pollers
      thisServer = new LokiAppDotNetAPI(this.ourKey, serverUrl);

      const gotToken = await thisServer.getOrRefreshServerToken();
      if (!gotToken) {
        log.warn(`Invalid server ${serverUrl}`);
        return null;
      }
      log.info(`set token ${thisServer.token} for ${serverUrl}`);

      this.servers.push(thisServer);
    }
    return thisServer;
  }

  static async getServerTime() {
    const url = `${window.getDefaultFileServer()}/loki/v1/time`;
    let timestamp = NaN;

    try {
      const res = await nodeFetch(url);
      if (res.ok) {
        timestamp = await res.text();
      }
    } catch (e) {
      return timestamp;
    }

    return Number(timestamp);
  }

  static async getTimeDifferential() {
    // Get time differential between server and client in seconds
    const serverTime = await this.getServerTime();
    const clientTime = Math.ceil(Date.now() / 1000);

    if (Number.isNaN(serverTime)) {
      return 0;
    }
    return serverTime - clientTime;
  }

  static async setClockParams() {
    // Set server-client time difference
    const maxTimeDifferential = 30;
    const timeDifferential = await this.getTimeDifferential();

    window.clientClockSynced = Math.abs(timeDifferential) < maxTimeDifferential;
    return window.clientClockSynced;
  }

  // channel getter/factory
  async findOrCreateChannel(serverUrl, channelId, conversationId) {
    const server = await this.findOrCreateServer(serverUrl);
    if (!server) {
      log.error(`Failed to create server for: ${serverUrl}`);
      return null;
    }
    return server.findOrCreateChannel(this, channelId, conversationId);
  }

  // deallocate resources server uses
  unregisterChannel(serverUrl, channelId) {
    const i = this.servers.findIndex(
      server => server.baseServerUrl === serverUrl
    );
    if (i === -1) {
      log.warn(`Tried to unregister from nonexistent server ${serverUrl}`);
      return;
    }
    const thisServer = this.servers[i];
    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${i}`);
      return;
    }
    thisServer.unregisterChannel(channelId);
    this.servers.splice(i, 1);
  }

  // shouldn't this be scoped per conversation?
  async getListOfMembers() {
    // enable in the next release
    /*
    let members = [];
    await Promise.all(this.servers.map(async server => {
      await Promise.all(server.channels.map(async channel => {
        const newMembers = await channel.getSubscribers();
        members = [...members, ...newMembers];
      }));
    }));
    const results = members.map(member => {
      return { authorPhoneNumber: member.username };
    });
    */
    return this.allMembers;
  }

  // TODO: make this private (or remove altogether) when
  // we switch to polling the server for group members
  setListOfMembers(members) {
    this.allMembers = members;
  }

  async setProfileName(profileName) {
    await Promise.all(
      this.servers.map(async server => {
        await server.setProfileName(profileName);
      })
    );
  }

  async setHomeServer(homeServer) {
    await Promise.all(
      this.servers.map(async server => {
        // this may fail
        // but we can't create a sql table to remember to retry forever
        // I think we just silently fail for now
        await server.setHomeServer(homeServer);
      })
    );
  }

  async setAvatar(url, profileKey) {
    await Promise.all(
      this.servers.map(async server => {
        // this may fail
        // but we can't create a sql table to remember to retry forever
        // I think we just silently fail for now
        await server.setAvatar(url, profileKey);
      })
    );
  }
}

module.exports = LokiPublicChatFactoryAPI;
