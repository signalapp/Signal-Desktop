/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, window, textsecure */

const EventEmitter = require('events');

const PER_MIN = 60 * 1000;
const PER_HR = 60 * PER_MIN;
const RSS_POLL_EVERY = 1 * PER_HR; // once an hour

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
    // initial set up
    this.getFeed();
  }

  async getFeed() {
    // deal with file server proxy hardcoding
    const map = {
      'https://loki.network/category/messenger-updates/feed/':
        'loki/v1/rss/messenger',
      'https://loki.network/feed/': 'loki/v1/rss/loki',
    };
    if (map[this.feedUrl] === undefined) {
      log.warn('LokiRssAPI unsupported rss feed', this.feedUrl);
      return;
    }
    const result = await window.lokiFileServerAPI._server.serverRequest(
      map[this.feedUrl]
    );
    if (!result) {
      log.error('LokiRssAPI empty rss proxy response');
      return;
    }
    if (!result.response) {
      log.error('LokiRssAPI rss proxy error, no response', result);
      return;
    }
    if (!result.response.data) {
      log.error(
        'LokiRssAPI rss proxy error, no data, response',
        result.response
      );
      return;
    }
    const responseXML = result.response.data;
    let feedDOM = {};
    try {
      feedDOM = await new window.DOMParser().parseFromString(
        responseXML,
        'text/xml'
      );
    } catch (e) {
      log.error('LokiRssAPI xml parsing error', e, responseXML);
      return;
    }
    const feedObj = xml2json(feedDOM);
    let receivedAt = new Date().getTime();

    if (!feedObj || !feedObj.rss || !feedObj.rss.channel) {
      log.error(
        'LokiRssAPI rss structure error',
        feedObj,
        feedDOM,
        responseXML
      );
      return;
    }
    if (!feedObj.rss.channel.item) {
      // no records, not an error
      return;
    }
    if (feedObj.rss.channel.item.constructor !== Array) {
      // Treat single record as array for consistency
      feedObj.rss.channel.item = [feedObj.rss.channel.item];
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
    const ref = this;
    function callTimer() {
      ref.getFeed();
    }
    this.feedTimer = setTimeout(callTimer, RSS_POLL_EVERY);
  }
}

module.exports = LokiRssAPI;
