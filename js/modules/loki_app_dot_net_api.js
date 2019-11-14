/* global log, textsecure, libloki, Signal, Whisper, Headers, ConversationController,
clearTimeout, MessageController, libsignal, StringView, window, _, lokiFileServerAPI,
dcodeIO, Buffer */
const EventEmitter = require('events');
const nodeFetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');
const FormData = require('form-data');

// Can't be less than 1200 if we have unauth'd requests
const PUBLICCHAT_MSG_POLL_EVERY = 1.5 * 1000; // 1.5s
const PUBLICCHAT_CHAN_POLL_EVERY = 20 * 1000; // 20s
const PUBLICCHAT_DELETION_POLL_EVERY = 5 * 1000; // 5s
const PUBLICCHAT_MOD_POLL_EVERY = 30 * 1000; // 30s
const PUBLICCHAT_MIN_TIME_BETWEEN_DUPLICATE_MESSAGES = 10 * 1000; // 10s

const ATTACHMENT_TYPE = 'net.app.core.oembed';
const LOKI_ATTACHMENT_TYPE = 'attachment';
const LOKI_PREVIEW_TYPE = 'preview';

// not quite a singleton yet (one for chat and one per file server)
class LokiAppDotNetAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
    this.myPrivateKey = false;

    // Multidevice states
    this.slavePrimaryMap = {};
    this.primaryUserProfileName = {};
  }

  async close() {
    await Promise.all(this.servers.map(server => server.close()));
  }

  async getPrivateKey() {
    if (!this.myPrivateKey) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      this.myPrivateKey = myKeyPair.privKey;
    }
    return this.myPrivateKey;
  }

  // server getter/factory
  async findOrCreateServer(serverUrl) {
    let thisServer = this.servers.find(
      server => server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      log.info(`LokiAppDotNetAPI creating ${serverUrl}`);
      thisServer = new LokiAppDotNetServerAPI(this, serverUrl);
      const gotToken = await thisServer.getOrRefreshServerToken();
      if (!gotToken) {
        log.warn(`Invalid server ${serverUrl}`);
        return null;
      }
      log.info(`set token ${thisServer.token}`);

      this.servers.push(thisServer);
    }
    return thisServer;
  }

  // channel getter/factory
  async findOrCreateChannel(serverUrl, channelId, conversationId) {
    const server = await this.findOrCreateServer(serverUrl);
    if (!server) {
      log.error(`Failed to create server for: ${serverUrl}`);
      return null;
    }
    return server.findOrCreateChannel(channelId, conversationId);
  }

  // deallocate resources server uses
  unregisterChannel(serverUrl, channelId) {
    let thisServer;
    let i = 0;
    for (; i < this.servers.length; i += 1) {
      if (this.servers[i].baseServerUrl === serverUrl) {
        thisServer = this.servers[i];
        break;
      }
    }

    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${serverUrl}`);
      return;
    }
    thisServer.unregisterChannel(channelId);
    this.servers.splice(i, 1);
  }

  getListOfMembers() {
    return this.allMembers;
  }

  // TODO: make this private (or remove altogether) when
  // we switch to polling the server for group members
  setListOfMembers(members) {
    this.allMembers = members;
  }
}

class LokiAppDotNetServerAPI {
  constructor(chatAPI, url) {
    this.chatAPI = chatAPI;
    this.channels = [];
    this.tokenPromise = null;
    this.baseServerUrl = url;
  }

  async close() {
    this.channels.forEach(channel => channel.stop());
    if (this.tokenPromise) {
      await this.tokenPromise;
    }
  }

  // channel getter/factory
  findOrCreateChannel(channelId, conversationId) {
    let thisChannel = this.channels.find(
      channel => channel.channelId === channelId
    );
    if (!thisChannel) {
      log.info(`LokiAppDotNetAPI creating channel ${conversationId}`);
      thisChannel = new LokiPublicChannelAPI(this, channelId, conversationId);
      this.channels.push(thisChannel);
    }
    return thisChannel;
  }

  // deallocate resources channel uses
  unregisterChannel(channelId) {
    let thisChannel;
    let i = 0;
    for (; i < this.channels.length; i += 1) {
      if (this.channels[i].channelId === channelId) {
        thisChannel = this.channels[i];
        break;
      }
    }
    if (!thisChannel) {
      return;
    }
    thisChannel.stop();
    this.channels.splice(i, 1);
  }

  // get active token for this server
  async getOrRefreshServerToken(forceRefresh = false) {
    let token;
    if (!forceRefresh) {
      if (this.token) {
        return this.token;
      }
      token = await Signal.Data.getPublicServerTokenByServerUrl(
        this.baseServerUrl
      );
    }
    if (!token) {
      token = await this.refreshServerToken();
      if (token) {
        await Signal.Data.savePublicServerToken({
          serverUrl: this.baseServerUrl,
          token,
        });
      }
    }
    this.token = token;

    // verify token info
    const tokenRes = await this.serverRequest('token');
    // if no problems and we have data
    if (
      !tokenRes.err &&
      tokenRes.response &&
      tokenRes.response.data &&
      tokenRes.response.data.user
    ) {
      // get our profile name and write it to the network
      const ourNumber = textsecure.storage.user.getNumber();
      const profileConvo = ConversationController.get(ourNumber);
      const profileName = profileConvo.getProfileName();

      // update profile name as needed
      if (tokenRes.response.data.user.name !== profileName) {
        if (profileName) {
          // will need this when we add an annotation
          /*
          const privKey = await this.serverAPI.chatAPI.getPrivateKey();
          // we might need an annotation that sets the homeserver for media
          // better to include this with each attachment...
          const objToSign = {
            name: profileName,
            version: 1,
            annotations: [],
          };
          const sig = await libsignal.Curve.async.calculateSignature(
            privKey,
            JSON.stringify(objToSign)
          );
          */

          await this.serverRequest('users/me', {
            method: 'PATCH',
            objBody: {
              name: profileName,
            },
          });
          // no big deal if it fails...
          // } else {
          // should we update the local from the server?
          // guessing no because there will be multiple servers
        }
        // update our avatar if needed
      }
    }

    return token;
  }

  // get active token from server (but only allow one request at a time)
  async refreshServerToken() {
    // if currently not in progress
    if (this.tokenPromise === null) {
      // set lock
      this.tokenPromise = new Promise(async res => {
        // request the oken
        const token = await this.requestToken();
        if (!token) {
          res(null);
          return;
        }
        // activate the token
        const registered = await this.submitToken(token);
        if (!registered) {
          res(null);
          return;
        }
        // resolve promise to release lock
        res(token);
      });
    }
    // wait until we have it set
    const token = await this.tokenPromise;
    // clear lock
    this.tokenPromise = null;
    return token;
  }

  // request an token from the server
  async requestToken() {
    let res;
    try {
      const url = new URL(`${this.baseServerUrl}/loki/v1/get_challenge`);
      const params = {
        pubKey: this.chatAPI.ourKey,
      };
      url.search = new URLSearchParams(params);

      res = await nodeFetch(url);
    } catch (e) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    const token = await libloki.crypto.decryptToken(body);
    return token;
  }

  // activate token
  async submitToken(token) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pubKey: this.chatAPI.ourKey,
        token,
      }),
    };

    try {
      const res = await nodeFetch(
        `${this.baseServerUrl}/loki/v1/submit_challenge`,
        options
      );
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // make a request to the server
  async serverRequest(endpoint, options = {}) {
    const {
      params = {},
      method,
      rawBody,
      objBody,
      forceFreshToken = false,
    } = options;
    const url = new URL(`${this.baseServerUrl}/${endpoint}`);
    if (params) {
      url.search = new URLSearchParams(params);
    }
    let result;
    const token = await this.getOrRefreshServerToken();
    if (!token) {
      log.error('NO TOKEN');
      return {
        err: 'noToken',
      };
    }
    try {
      const fetchOptions = {};
      const headers = {
        Authorization: `Bearer ${this.token}`,
      };
      if (method) {
        fetchOptions.method = method;
      }
      if (objBody) {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(objBody);
      } else if (rawBody) {
        fetchOptions.body = rawBody;
      }
      fetchOptions.headers = new Headers(headers);
      result = await nodeFetch(url, fetchOptions || undefined);
    } catch (e) {
      log.info(`e ${e}`);
      return {
        err: e,
      };
    }
    let response = null;
    try {
      response = await result.json();
    } catch (e) {
      log.warn(`serverRequest json arpse ${e}`);
      return {
        err: e,
        statusCode: result.status,
      };
    }

    // if it's a response style with a meta
    if (result.status !== 200) {
      if (!forceFreshToken && response.meta.code === 401) {
        // copy options because lint complains if we modify this directly
        const updatedOptions = options;
        // force it this time
        updatedOptions.forceFreshToken = true;
        // retry with updated options
        return this.serverRequest(endpoint, updatedOptions);
      }
      return {
        err: 'statusCode',
        statusCode: result.status,
        response,
      };
    }
    return {
      statusCode: result.status,
      response,
    };
  }

  async getUserAnnotations(pubKey) {
    if (!pubKey) {
      log.warn('No pubkey provided to getUserAnnotations!');
      return [];
    }
    const res = await this.serverRequest(`users/@${pubKey}`, {
      method: 'GET',
      params: {
        include_user_annotations: 1,
      },
    });

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`Error ${res.err}`);
      }
      return [];
    }

    return res.response.data.annotations || [];
  }

  async getUsers(pubKeys) {
    if (!pubKeys) {
      log.warn('No pubKeys provided to getUsers!');
      return [];
    }
    if (!pubKeys.length) {
      log.warn('No pubKeys given to getUsers!');
      return [];
    }
    if (pubKeys.length > 200) {
      log.warn('Too many pubKeys given to getUsers!');
    }
    const res = await this.serverRequest('users', {
      method: 'GET',
      params: {
        ids: pubKeys.join(','),
        include_user_annotations: 1,
      },
    });

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`Error ${res.err}`);
      }
      return [];
    }

    return res.response.data || [];
  }

  // Only one annotation at a time
  async setSelfAnnotation(type, value) {
    const annotation = { type };

    // to delete annotation, omit the "value" field
    if (value) {
      annotation.value = value;
    }

    const res = await this.serverRequest('users/me', {
      method: 'PATCH',
      objBody: {
        annotations: [annotation],
      },
    });

    if (!res.err && res.response) {
      return res.response;
    }

    return false;
  }

  async uploadData(data) {
    const endpoint = 'files';
    const options = {
      method: 'POST',
      rawBody: data,
    };

    const { statusCode, response } = await this.serverRequest(
      endpoint,
      options
    );
    if (statusCode !== 200) {
      log.warn('Failed to upload data to fileserver');
      return null;
    }

    const url = response.data && response.data.url;
    const id = response.data && response.data.id;
    return {
      url,
      id,
    };
  }

  putAttachment(attachmentBin) {
    const formData = new FormData();
    const buffer = Buffer.from(attachmentBin);
    formData.append('type', 'network.loki');
    formData.append('content', buffer, {
      contentType: 'application/octet-stream',
      name: 'content',
      filename: 'attachment',
    });

    return this.uploadData(formData);
  }
}

class LokiPublicChannelAPI {
  constructor(serverAPI, channelId, conversationId) {
    // properties
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `channels/${this.channelId}`;
    this.conversationId = conversationId;
    this.conversation = ConversationController.get(conversationId);
    this.lastGot = null;
    this.modStatus = false;
    this.deleteLastId = 1;
    this.timers = {};
    this.running = true;
    // can escalated to SQL if it start uses too much memory
    this.logMop = {};

    // Cache for duplicate checking
    this.lastMessagesCache = [];

    // end properties

    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
    this.pollForDeletions();
    this.pollForChannel();
    this.pollForModerators();

    // TODO: poll for group members here?
  }

  stop() {
    this.running = false;
    if (this.timers.channel) {
      clearTimeout(this.timers.channel);
    }
    if (this.timers.moderator) {
      clearTimeout(this.timers.moderator);
    }
    if (this.timers.delete) {
      clearTimeout(this.timers.delete);
    }
    if (this.timers.message) {
      clearTimeout(this.timers.message);
    }
  }

  serverRequest(endpoint, options = {}) {
    return this.serverAPI.serverRequest(endpoint, options);
  }

  // get moderation actions
  async pollForModerators() {
    try {
      await this.pollOnceForModerators();
    } catch (e) {
      log.warn(`Error while polling for public chat moderators: ${e}`);
    }
    if (this.running) {
      this.timers.moderator = setTimeout(() => {
        this.pollForModerators();
      }, PUBLICCHAT_MOD_POLL_EVERY);
    }
  }

  // get moderator status
  async pollOnceForModerators() {
    // get moderator status
    const res = await this.serverRequest(
      `loki/v1/channel/${this.channelId}/get_moderators`
    );
    const ourNumber = textsecure.storage.user.getNumber();

    // Get the list of moderators if no errors occurred
    const moderators = !res.err && res.response && res.response.moderators;

    // if we encountered problems then we'll keep the old mod status
    if (moderators) {
      this.modStatus = moderators.includes(ourNumber);
    }

    await this.conversation.setModerators(moderators || []);
  }

  // delete a message on the server
  async deleteMessage(serverId, canThrow = false) {
    const res = await this.serverRequest(
      this.modStatus
        ? `loki/v1/moderation/message/${serverId}`
        : `${this.baseChannelUrl}/messages/${serverId}`,
      { method: 'DELETE' }
    );
    if (!res.err && res.response) {
      log.info(`deleted ${serverId} on ${this.baseChannelUrl}`);
      return true;
    }
    // fire an alert
    log.warn(`failed to delete ${serverId} on ${this.baseChannelUrl}`);
    if (canThrow) {
      throw new textsecure.PublicChatError(
        'Failed to delete public chat message'
      );
    }
    return false;
  }

  // used for sending messages
  getEndpoint() {
    const endpoint = `${this.serverAPI.baseServerUrl}/${
      this.baseChannelUrl
    }/messages`;
    return endpoint;
  }

  // get moderation actions
  async pollForChannel() {
    try {
      await this.pollForChannelOnce();
    } catch (e) {
      log.warn(`Error while polling for public chat room details: ${e}`);
    }
    if (this.running) {
      this.timers.channel = setTimeout(() => {
        this.pollForChannel();
      }, PUBLICCHAT_CHAN_POLL_EVERY);
    }
  }

  // update room details
  async pollForChannelOnce() {
    const res = await this.serverRequest(`${this.baseChannelUrl}`, {
      params: {
        include_annotations: 1,
      },
    });
    if (
      !res.err &&
      res.response &&
      res.response.data.annotations &&
      res.response.data.annotations.length
    ) {
      res.response.data.annotations.forEach(note => {
        if (note.type === 'net.patter-app.settings') {
          // note.value.description only needed for directory
          if (note.value && note.value.name) {
            this.conversation.setGroupName(note.value.name);
          }
          if (note.value && note.value.avatar) {
            this.conversation.setProfileAvatar(note.value.avatar);
          }
          // else could set a default in case of server problems...
        }
      });
    }
  }

  // get moderation actions
  async pollForDeletions() {
    try {
      await this.pollOnceForDeletions();
    } catch (e) {
      log.warn(`Error while polling for public chat deletions: ${e}`);
    }
    if (this.running) {
      this.timers.delete = setTimeout(() => {
        this.pollForDeletions();
      }, PUBLICCHAT_DELETION_POLL_EVERY);
    }
  }

  async pollOnceForDeletions() {
    // grab the last 200 deletions
    const params = {
      count: 200,
    };

    // start loop
    let more = true;
    while (more) {
      // set params to from where we last checked
      params.since_id = this.deleteLastId;

      // grab the next 200 deletions from where we last checked
      // eslint-disable-next-line no-await-in-loop
      const res = await this.serverRequest(
        `loki/v1/channel/${this.channelId}/deletes`,
        { params }
      );

      // if any problems, abort out
      if (res.err || !res.response) {
        if (res.err) {
          log.error(`Error ${res.err}`);
        }
        break;
      }

      // Process results
      res.response.data.reverse().forEach(deleteEntry => {
        // Escalate it up to the subsystem that can check to see if this has
        // been processed
        Whisper.events.trigger('deleteLocalPublicMessage', {
          messageServerId: deleteEntry.message_id,
          conversationId: this.conversationId,
        });
      });

      // update where we last checked
      this.deleteLastId = res.response.meta.max_id;
      more = res.response.meta.more && res.response.data.length >= params.count;
    }
  }

  static getSigData(
    sigVer,
    noteValue,
    attachmentAnnotations,
    previewAnnotations,
    adnMessage
  ) {
    let sigString = '';
    sigString += adnMessage.text.trim();
    sigString += noteValue.timestamp;
    if (noteValue.quote) {
      sigString += noteValue.quote.id;
      sigString += noteValue.quote.author;
      sigString += noteValue.quote.text.trim();
      if (adnMessage.reply_to) {
        sigString += adnMessage.reply_to;
      }
    }
    sigString += [...attachmentAnnotations, ...previewAnnotations]
      .map(data => data.id || data.image.id)
      .sort()
      .join();
    sigString += sigVer;
    return dcodeIO.ByteBuffer.wrap(sigString, 'utf8').toArrayBuffer();
  }

  async getMessengerData(adnMessage) {
    if (
      !Array.isArray(adnMessage.annotations) ||
      adnMessage.annotations.length === 0
    ) {
      return false;
    }
    const noteValue = adnMessage.annotations[0].value;

    // signatures now required
    if (!noteValue.sig || typeof noteValue.sig !== 'string') {
      return false;
    }

    // timestamp is the only required field we've had since the first deployed version
    const { timestamp, quote } = noteValue;

    if (quote) {
      // TODO: Enable quote attachments again using proper ADN style
      quote.attachments = [];
    }

    // try to verify signature
    const { sig, sigver } = noteValue;
    const annoCopy = [...adnMessage.annotations];
    const attachments = annoCopy
      .filter(anno => anno.value.lokiType === LOKI_ATTACHMENT_TYPE)
      .map(attachment => ({ isRaw: true, ...attachment.value }));
    const preview = annoCopy
      .filter(anno => anno.value.lokiType === LOKI_PREVIEW_TYPE)
      .map(LokiPublicChannelAPI.getPreviewFromAnnotation);
    // strip out sig and sigver
    annoCopy[0] = _.omit(annoCopy[0], ['value.sig', 'value.sigver']);
    const sigData = LokiPublicChannelAPI.getSigData(
      sigver,
      noteValue,
      attachments,
      preview,
      adnMessage
    );

    const pubKeyBin = StringView.hexToArrayBuffer(adnMessage.user.username);
    const sigBin = StringView.hexToArrayBuffer(sig);
    try {
      await libsignal.Curve.async.verifySignature(pubKeyBin, sigData, sigBin);
    } catch (e) {
      if (e.message === 'Invalid signature') {
        // keep noise out of the logs, once per start up is enough
        if (this.logMop[adnMessage.id] === undefined) {
          log.warn(
            'Invalid or missing signature on ',
            this.serverAPI.baseServerUrl,
            this.channelId,
            adnMessage.id,
            'says',
            adnMessage.text,
            'from',
            adnMessage.user.username,
            'signature',
            sig,
            'signature version',
            sigver
          );
          this.logMop[adnMessage.id] = true;
        }
        // we now only accept valid messages into the public chat
        return false;
      }
      // any error should cause problem
      log.error(`Unhandled message signature validation error ${e.message}`);
      return false;
    }

    return {
      timestamp,
      attachments,
      preview,
      quote,
    };
  }

  // get channel messages
  async pollForMessages() {
    try {
      await this.pollOnceForMessages();
    } catch (e) {
      log.warn(`Error while polling for public chat messages: ${e}`);
    }
    if (this.running) {
      setTimeout(() => {
        this.timers.message = this.pollForMessages();
      }, PUBLICCHAT_MSG_POLL_EVERY);
    }
  }

  async pollOnceForMessages() {
    const params = {
      include_annotations: 1,
      include_deleted: false,
    };
    if (!this.conversation) {
      log.warn('Trying to poll for non-existing public conversation');
      this.lastGot = 0;
    } else if (!this.lastGot) {
      this.lastGot = this.conversation.getLastRetrievedMessage();
    }
    params.since_id = this.lastGot;
    // Just grab the most recent 100 messages if you don't have a valid lastGot
    params.count = this.lastGot === 0 ? -100 : 20;
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      params,
    });

    if (!res.err && res.response) {
      let receivedAt = new Date().getTime();
      const pubKeys = [];
      let pendingMessages = [];
      pendingMessages = await Promise.all(
        res.response.data.reverse().map(async adnMessage => {
          // still update our last received if deleted, not signed or not valid
          this.lastGot = !this.lastGot
            ? adnMessage.id
            : Math.max(this.lastGot, adnMessage.id);

          if (
            !adnMessage.id ||
            !adnMessage.user ||
            !adnMessage.user.username || // pubKey lives in the username field
            !adnMessage.text ||
            adnMessage.is_deleted
          ) {
            return false; // Invalid or delete message
          }

          const messengerData = await this.getMessengerData(adnMessage);
          if (messengerData === false) {
            return false;
          }

          const { timestamp, quote, attachments, preview } = messengerData;
          if (!timestamp) {
            return false; // Invalid message
          }

          // Duplicate check
          const isDuplicate = message => {
            // The username in this case is the users pubKey
            const sameUsername = message.username === adnMessage.user.username;
            const sameText = message.text === adnMessage.text;
            // Don't filter out messages that are too far apart from each other
            const timestampsSimilar =
              Math.abs(message.timestamp - timestamp) <=
              PUBLICCHAT_MIN_TIME_BETWEEN_DUPLICATE_MESSAGES;

            return sameUsername && sameText && timestampsSimilar;
          };

          // Filter out any messages that we got previously
          if (this.lastMessagesCache.some(isDuplicate)) {
            return false; // Duplicate message
          }

          // FIXME: maybe move after the de-multidev-decode
          // Add the message to the lastMessage cache and keep the last 5 recent messages
          this.lastMessagesCache = [
            ...this.lastMessagesCache,
            {
              username: adnMessage.user.username,
              text: adnMessage.text,
              timestamp,
            },
          ].splice(-5);

          const from = adnMessage.user.name || 'Anonymous'; // profileName
          if (pubKeys.indexOf(`@${adnMessage.user.username}`) === -1) {
            pubKeys.push(`@${adnMessage.user.username}`);
          }

          const messageData = {
            serverId: adnMessage.id,
            clientVerified: true,
            friendRequest: false,
            source: adnMessage.user.username,
            sourceDevice: 1,
            timestamp,

            serverTimestamp: timestamp,
            receivedAt,
            isPublic: true,
            message: {
              body:
                adnMessage.text === timestamp.toString() ? '' : adnMessage.text,
              attachments,
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
              quote,
              contact: [],
              preview,
              profile: {
                displayName: from,
              },
            },
          };
          receivedAt += 1; // Ensure different arrival times

          // now process any user meta data updates
          // - update their conversation with a potentially new avatar
          return messageData;
        })
      );
      this.conversation.setLastRetrievedMessage(this.lastGot);

      if (pendingMessages.length) {
        // console.log('premultiDeviceResults', pubKeys);
        if (pubKeys.length) {
          // this will set slavePrimaryMap
          const verifiedPrimaryPKs = await lokiFileServerAPI.verifyPrimaryPubKeys(
            pubKeys
          );
          const { slavePrimaryMap } = this.serverAPI.chatAPI;

          const slaveMessages = {};
          // sort pending messages
          pendingMessages.forEach(messageData => {
            // why am I getting these?
            if (messageData === undefined) {
              log.warn('invalid pendingMessages');
              return;
            }
            // if a known slave, queue
            if (slavePrimaryMap[messageData.source]) {
              // delay sending the message
              if (slaveMessages[messageData.source] === undefined) {
                slaveMessages[messageData.source] = [messageData];
              } else {
                slaveMessages[messageData.source].push(messageData);
              }
            } else {
              // no user or isPrimary means not multidevice, send event now
              this.serverAPI.chatAPI.emit('publicMessage', {
                message: messageData,
              });
            }
          });
          pendingMessages = []; // free memory

          // build map of userProfileName to primaryKeys
          // if we have verified primaryKeys/the claimed relation
          if (verifiedPrimaryPKs.length) {
            // get final list of verified chat server profile names
            const verifiedDeviceResults = await this.serverAPI.getUsers(
              verifiedPrimaryPKs
            );
            // console.log('verifiedDeviceResults', verifiedDeviceResults)

            // go through verifiedDeviceResults
            const newPrimaryUserProfileName = {};
            verifiedDeviceResults.forEach(user => {
              newPrimaryUserProfileName[user.username] = user.name;
            });
            // replace whole
            this.primaryUserProfileName = newPrimaryUserProfileName;
          }

          // process remaining messages
          const ourNumber = textsecure.storage.user.getNumber();
          Object.keys(slaveMessages).forEach(slaveKey => {
            // prevent our own sent messages from coming back in
            if (slaveKey === ourNumber) {
              // we originally sent these
              return;
            }
            const primaryPubKey = slavePrimaryMap[slaveKey];
            slaveMessages[slaveKey].forEach(messageDataP => {
              const messageData = messageDataP; // for linter
              if (slavePrimaryMap[messageData.source]) {
                // rewrite source, profile
                messageData.source = primaryPubKey;
                messageData.message.profile.displayName = this.primaryUserProfileName[
                  primaryPubKey
                ];
              }
              this.serverAPI.chatAPI.emit('publicMessage', {
                message: messageData,
              });
            });
          });
        } // end if there are pending pubkeys to look up

        // console.log('pendingMessages len', pendingMessages.length);
        // console.log('pendingMessages', pendingMessages);
        // find messages for original slave key using slavePrimaryMap
        if (pendingMessages.length) {
          const { slavePrimaryMap } = this.serverAPI.chatAPI;
          const ourNumber = textsecure.storage.user.getNumber();
          pendingMessages.forEach(messageDataP => {
            const messageData = messageDataP; // for linter
            // why am I getting these?
            if (messageData === undefined) {
              log.warn(`invalid pendingMessages ${pendingMessages}`);
              return;
            }
            // prevent our own sent messages from coming back in
            if (messageData.source === ourNumber) {
              // we originally sent this
              return;
            }
            if (slavePrimaryMap[messageData.source]) {
              // rewrite source, profile
              const primaryPubKey = slavePrimaryMap[messageData.source];
              log.info(`Rewriting ${messageData.source} to ${primaryPubKey}`);
              messageData.source = primaryPubKey;
              messageData.message.profile.displayName = this.primaryUserProfileName[
                primaryPubKey
              ];
            }
            this.serverAPI.chatAPI.emit('publicMessage', {
              message: messageData,
            });
          });
        }
        pendingMessages = [];
      }
    }
  }

  static getPreviewFromAnnotation(annotation) {
    const preview = {
      title: annotation.value.linkPreviewTitle,
      url: annotation.value.linkPreviewUrl,
      image: {
        isRaw: true,
        caption: annotation.value.caption,
        contentType: annotation.value.contentType,
        digest: annotation.value.digest,
        fileName: annotation.value.fileName,
        flags: annotation.value.flags,
        height: annotation.value.height,
        id: annotation.value.id,
        key: annotation.value.key,
        size: annotation.value.size,
        thumbnail: annotation.value.thumbnail,
        url: annotation.value.url,
        width: annotation.value.width,
      },
    };
    return preview;
  }

  static getAnnotationFromPreview(preview) {
    const annotation = {
      type: ATTACHMENT_TYPE,
      value: {
        // Mandatory ADN fields
        version: '1.0',
        lokiType: LOKI_PREVIEW_TYPE,

        // Signal stuff we actually care about
        linkPreviewTitle: preview.title,
        linkPreviewUrl: preview.url,
        caption: preview.image.caption,
        contentType: preview.image.contentType,
        digest: preview.image.digest,
        fileName: preview.image.fileName,
        flags: preview.image.flags,
        height: preview.image.height,
        id: preview.image.id,
        key: preview.image.key,
        size: preview.image.size,
        thumbnail: preview.image.thumbnail,
        url: preview.image.url,
        width: preview.image.width,
      },
    };
    return annotation;
  }

  static getAnnotationFromAttachment(attachment) {
    const type = attachment.contentType.match(/^image/) ? 'photo' : 'video';
    const annotation = {
      type: ATTACHMENT_TYPE,
      value: {
        // Mandatory ADN fields
        version: '1.0',
        type,
        lokiType: LOKI_ATTACHMENT_TYPE,

        // Signal stuff we actually care about
        ...attachment,
      },
    };
    return annotation;
  }

  // create a message in the channel
  async sendMessage(data, messageTimeStamp) {
    const { quote, attachments, preview } = data;
    const text = data.body || messageTimeStamp.toString();
    const attachmentAnnotations = attachments.map(
      LokiPublicChannelAPI.getAnnotationFromAttachment
    );
    const previewAnnotations = preview.map(
      LokiPublicChannelAPI.getAnnotationFromPreview
    );

    const payload = {
      text,
      annotations: [
        {
          type: 'network.loki.messenger.publicChat',
          value: {
            timestamp: messageTimeStamp,
          },
        },
        ...attachmentAnnotations,
        ...previewAnnotations,
      ],
    };
    if (quote && quote.id) {
      payload.annotations[0].value.quote = quote;

      // copied from model/message.js copyFromQuotedMessage
      const collection = await Signal.Data.getMessagesBySentAt(quote.id, {
        MessageCollection: Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthor = item.getContact();

        return messageAuthor && quote.author === messageAuthor.id;
      });

      if (found) {
        const queryMessage = MessageController.register(found.id, found);
        const replyTo = queryMessage.get('serverId');
        if (replyTo) {
          payload.reply_to = replyTo;
        }
      }
    }
    const privKey = await this.serverAPI.chatAPI.getPrivateKey();
    const sigVer = 1;
    const mockAdnMessage = { text };
    if (payload.reply_to) {
      mockAdnMessage.reply_to = payload.reply_to;
    }
    const sigData = LokiPublicChannelAPI.getSigData(
      sigVer,
      payload.annotations[0].value,
      attachmentAnnotations.map(anno => anno.value),
      previewAnnotations.map(anno => anno.value),
      mockAdnMessage
    );
    const sig = await libsignal.Curve.async.calculateSignature(
      privKey,
      sigData
    );
    payload.annotations[0].value.sig = StringView.arrayBufferToHex(sig);
    payload.annotations[0].value.sigver = sigVer;
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      method: 'POST',
      objBody: payload,
    });
    if (!res.err && res.response) {
      window.mixpanel.track('Public Message Sent');
      return res.response.data.id;
    }
    // there's no retry on desktop
    // this is supposed to be after retries
    window.mixpanel.track('Failed to Send Public Message');
    return false;
  }
}

module.exports = LokiAppDotNetAPI;
