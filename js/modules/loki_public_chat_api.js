/* global log, textsecure */
const EventEmitter = require('events');
const nodeFetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');

const GROUPCHAT_POLL_EVERY = 1000; // 1 second

// singleton to relay events to libtextsecure/message_receiver
class LokiPublicChatAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.lastGot = {};
    this.servers = [];
  }
  findOrCreateServer(hostport) {
    log.info(`LokiPublicChatAPI looking for ${hostport}`);
    let thisServer = this.servers.find(server => server.server === hostport);
    if (!thisServer) {
      thisServer = new LokiPublicServerAPI(this, hostport);
      this.servers.push(thisServer);
    }
    return thisServer;
  }
  unregisterChannel(hostport, channelId) {
    const thisServer = this.servers.find(server => server.server === hostport);
    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${hostport}`);
      return;
    }
    thisServer.unregisterChannel(channelId);
    if (thisServer.channels.length === 0) {
      const index = this.servers.indexOf(thisServer);
      if (index > -1) {
        this.servers.splice(index, 1);
      }
    }
  }
}

class LokiPublicServerAPI {
  constructor(chatAPI, hostport) {
    this.chatAPI = chatAPI;
    this.server = hostport;
    this.channels = [];
  }
  findOrCreateChannel(channelId, conversationId) {
    let thisChannel = this.channels.find(channel => channel.channelId === channelId);
    if (!thisChannel) {
      thisChannel = new LokiPublicChannelAPI(this, channelId, conversationId);
      this.channels.push(thisChannel);
    }
    return thisChannel;
  }
  unregisterChannel(channelId) {
    const thisChannel = this.channels.find(channel => channel.channelId === channelId);
    if (!thisChannel) {
      return;
    }
    thisChannel.stopPolling = true;
    const index = this.channels.indexOf(thisChannel);
    if (index > -1) {
      this.channels.splice(index, 1);
    }
  }
}

class LokiPublicChannelAPI {
  constructor(serverAPI, channelId, conversationId) {
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `${serverAPI.server}/channels/${this.channelId}`;
    this.groupName = 'unknown';
    this.conversationId = conversationId;
    this.lastGot = 0;
    this.stopPolling = false;
    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
  }

  async pollForChannel(source, endpoint) {
    // groupName will be loaded from server
    const url = new URL(this.baseChannelUrl);
    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (response.meta.code !== 200) {
      success = false;
    }
    // update this.groupId
    return endpoint || success;
  }

  async pollForDeletions() {
    // read all messages from 0 to current
    // delete local copies if server state has changed to delete
    // run every minute
    const url = new URL(this.baseChannelUrl);
    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (response.meta.code !== 200) {
      success = false;
    }
    return success;
  }

  async pollForMessages() {
    const url = new URL(`${this.baseChannelUrl}/messages`);
    const params = {
      include_annotations: 1,
      count: -20,
    };
    if (this.lastGot) {
      params.since_id = this.lastGot;
    }
    url.search = new URLSearchParams(params);

    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (this.stopPolling) {
      // Stop after latest await possible
      return;
    }
    if (response.meta.code !== 200) {
      success = false;
    }

    if (success) {
      let receivedAt = new Date().getTime();
      response.data.forEach(adnMessage => {
        let timestamp = new Date(adnMessage.created_at).getTime();
        let from = adnMessage.user.username;
        let source;
        if (adnMessage.annotations.length) {
          const noteValue = adnMessage.annotations[0].value;
          ({ from, timestamp, source } = noteValue);
        }

        const messageData = {
          friendRequest: false,
          source,
          sourceDevice: 1,
          timestamp,
          serverTimestamp: timestamp,
          receivedAt,
          isPublic: true,
          message: {
            body: adnMessage.text,
            attachments: [],
            group: {
              id: this.conversationId,
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            },
            flags: 0,
            expireTimer: 0,
            profileKey: null,
            timestamp,
            received_at: receivedAt,
            sent_at: timestamp,
            quote: null,
            contact: [],
            preview: [],
            profile: {
              displayName: from,
            },
          },
        };
        receivedAt += 1; // Ensure different arrival times

        this.serverAPI.chatAPI.emit('publicMessage', {
          message: messageData,
        });
        this.lastGot = !this.lastGot
          ? adnMessage.id
          : Math.max(this.lastGot, adnMessage.id);
      });
    }

    setTimeout(() => {
      this.pollForMessages();
    }, GROUPCHAT_POLL_EVERY);
  }
}

module.exports = LokiPublicChatAPI;
