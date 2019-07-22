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
    let thisServer = null;
    log.info(`LokiPublicChatAPI looking for ${hostport}`);
    this.servers.some(server => {
      // if we already have this hostport registered
      if (server.server === hostport) {
        thisServer = server;
        return true;
      }
      return false;
    });
    if (thisServer === null) {
      thisServer = new LokiPublicServerAPI(this, hostport);
      this.servers.push(thisServer);
    }
    return thisServer;
  }
}

class LokiPublicServerAPI {
  constructor(chatAPI, hostport) {
    this.chatAPI = chatAPI;
    this.server = hostport;
    this.channels = [];
  }
  findOrCreateChannel(channelId, conversationId) {
    let thisChannel = null;
    this.channels.forEach(channel => {
      if (
        channel.channelId === channelId &&
        channel.conversationId === conversationId
      ) {
        thisChannel = channel;
      }
    });
    if (thisChannel === null) {
      thisChannel = new LokiPublicChannelAPI(this, channelId, conversationId);
      this.channels.push(thisChannel);
    }
    return thisChannel;
  }
  unregisterChannel(channelId) {
    // find it, remove it
    // if no channels left, request we deregister server
    return channelId || this; // this is just to make eslint happy
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
    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
  }

  async pollForChannel(source, endpoint) {
    // groupName will be loaded from server
    const url = new URL(this.baseChannelUrl);
    /*
    const params = {
      include_annotations: 1,
    };
    */
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
    // let id = 0;
    // read all messages from 0 to current
    // delete local copies if server state has changed to delete
    // run every minute
    const url = new URL(this.baseChannelUrl);
    /*
    const params = {
      include_annotations: 1,
    };
    */
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
    if (response.meta.code !== 200) {
      success = false;
    }

    if (success) {
      let receivedAt = new Date().getTime();
      response.data.forEach(adnMessage => {
        // FIXME: create proper message for this message.DataMessage.body
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
