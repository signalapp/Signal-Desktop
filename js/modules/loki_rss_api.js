/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, window, textsecure, ConversationController */

const EventEmitter = require('events');
const nodeFetch = require('node-fetch');

const RSS_FEED = 'https://loki.network/feed/';
const CONVO_ID = 'rss://loki.network/feed/';
const PER_MIN = 60 * 1000;
const PER_HR = 60 * PER_MIN;
const RSS_POLL_EVERY = 1 * PER_HR; // once an hour

function xml2json(xml) {
  try {
    let obj = {};
    if (xml.children.length > 0) {
      for (let i = 0; i < xml.children.length; i += 1) {
        const item = xml.children.item(i);
        const { nodeName } = item.nodeName;

        if (typeof obj[nodeName] === 'undefined') {
          obj[nodeName] = xml2json(item);
        } else {
          if (typeof obj[nodeName].push === 'undefined') {
            const old = obj[nodeName];

            obj[nodeName] = [];
            obj[nodeName].push(old);
          }
          obj[nodeName].push(xml2json(item));
        }
      }
    } else {
      obj = xml.textContent;
    }
    return obj;
  } catch (e) {
    log.error(e.message);
  }
  return {};
}

// hate duplicating this here...
const friendRequestStatusEnum = Object.freeze({
  // New conversation, no messages sent or received
  none: 0,
  // This state is used to lock the input early while sending
  pendingSend: 1,
  // Friend request sent, awaiting response
  requestSent: 2,
  // Friend request received, awaiting user input
  requestReceived: 3,
  // We did it!
  friends: 4,
  // Friend Request sent but timed out
  requestExpired: 5,
});

class LokiRssAPI extends EventEmitter {
  constructor() {
    super();
    // properties
    this.groupId = CONVO_ID;
    this.feedTimer = null;
    this.conversationSetup = false;
    // initial set up
    this.getFeed();
  }

  setupConversation() {
    // only run once
    if (this.conversationSetup) return;
    // wait until conversations are loaded
    if (ConversationController._initialFetchComplete) {
      const conversation = ConversationController.getOrCreate(
        this.groupId,
        'group'
      );
      conversation.setFriendRequestStatus(friendRequestStatusEnum.friends);
      conversation.setGroupNameAndAvatar(
        'Loki.network News',
        'images/loki/loki_icon.png'
      );
      conversation.updateTextInputState();
      this.conversationSetup = true; // prevent running again
    }
  }

  async getFeed() {
    let response;
    let success = true;
    try {
      response = await nodeFetch(RSS_FEED);
    } catch (e) {
      log.error('fetcherror', e);
      success = false;
    }
    const responseXML = await response.text();
    let feedDOM = {};
    try {
      feedDOM = await new window.DOMParser().parseFromString(
        responseXML,
        'text/xml'
      );
    } catch (e) {
      log.error('xmlerror', e);
      success = false;
    }
    if (!success) return;
    const feedObj = xml2json(feedDOM);
    let receivedAt = new Date().getTime();

    // make sure conversation is set up properly
    // (delay to after the network response intentionally)
    this.setupConversation();

    feedObj.rss.channel.item.reverse().forEach(item => {
      // log.debug('item', item)

      const pubDate = new Date(item.pubDate);

      // if we use group style, we can put the title in the source
      const messageData = {
        friendRequest: false,
        source: this.groupId,
        sourceDevice: 1,
        timestamp: pubDate.getTime(),
        serverTimestamp: pubDate.getTime(),
        receivedAt,
        isRss: true,
        message: {
          body: `<h2>${item.title}</h2>${item.description}`,
          attachments: [],
          group: {
            id: this.groupId,
            type: textsecure.protobuf.GroupContext.Type.DELIVER,
          },
          flags: 0,
          expireTimer: 0,
          profileKey: null,
          timestamp: pubDate.getTime(),
          received_at: receivedAt,
          sent_at: pubDate.getTime(),
          quote: null,
          contact: [],
          preview: [],
          profile: null,
        },
      };
      receivedAt += 1; // Ensure different arrival times
      this.emit('rssMessage', {
        message: messageData,
      });
    });
    function callTimer() {
      this.getFeed();
    }
    this.feedTimer = setTimeout(callTimer, RSS_POLL_EVERY);
  }
}

module.exports = LokiRssAPI;
