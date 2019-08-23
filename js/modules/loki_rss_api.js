/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, window, textsecure, ConversationController */

const EventEmitter = require('events');
const nodeFetch = require('node-fetch');

const friendRequestStatusEnum = require('./loki_friend_request_status');

const PER_MIN = 60 * 1000;
const PER_HR = 60 * PER_MIN;
const RSS_POLL_EVERY = 1 * PER_HR; // once an hour

/*
const dnsUtil = require('dns');
// how do we get our local version?
// how do we integrate with extensions.expired()
const VERSION_HOST = 'lastreleasedate.messenger.loki.network';

function getLastRelease(cb) {
  // doesn't look to have a promise interface
  dnsUtil.resolveTxt(VERSION_HOST, function handleResponse(err, records) {
    if (err) {
      console.error('getLastRelease error', err);
      cb();
      return;
    }
    if (records.length) {
      cb();
    }
    // return first record...
    cb(records[0]);
  });
}
*/

function xml2json(xml) {
  try {
    let obj = {};
    if (xml.children.length > 0) {
      for (let i = 0; i < xml.children.length; i += 1) {
        const item = xml.children.item(i);
        const { nodeName } = item;

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

class LokiRssAPI extends EventEmitter {
  constructor(settings) {
    super();
    // properties
    this.feedUrl = settings.RSS_FEED;
    this.groupId = settings.CONVO_ID;
    this.feedTitle = settings.title;
    this.closeable = settings.closeable;
    // non configureable options
    this.feedTimer = null;
    this.conversationSetup = false;
    // initial set up
    this.getFeed();
  }

  async getFeed() {
    let response;
    let success = true;
    try {
      response = await nodeFetch(this.feedUrl);
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

    if (!feedObj || !feedObj.rss || !feedObj.rss.channel) {
      log.error('rsserror', feedObj, feedDOM, responseXML);
      return;
    }
    if (!feedObj.rss.channel.item) {
      // no records
      return;
    }
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
          body: `<h2>${item.title} </h2>${item.description}`,
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
