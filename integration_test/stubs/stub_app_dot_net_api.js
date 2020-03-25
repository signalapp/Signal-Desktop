/* global clearTimeout, Buffer, TextDecoder, process */

const OriginalAppDotNetApi = require('../../js/modules/loki_app_dot_net_api.js');

const sampleFeed =
  '<?xml version="1.0" encoding="windows-1252"?><rss version="2.0"><channel>    <title>FeedForAll Sample Feed</title></channel></rss>';

const samplesGetMessages = {
  meta: { code: 200 },
  data: [
    {
      channel_id: 1,
      created_at: '2020-03-18T04:48:44.000Z',
      entities: {
        mentions: [],
        hashtags: [],
        links: [],
      },
      id: 3662,
      machine_only: false,
      num_replies: 0,
      source: {},
      thread_id: 3662,
      reply_to: null,
      text: 'hgt',
      html: '<span itemscope="https://app.net/schemas/Post">hgt</span>',
      annotations: [
        {
          type: 'network.loki.messenger.publicChat',
          value: {
            timestamp: 1584506921361,
            sig:
              '262ab113810564d7ff6474dea264e10e2143d91c004903d06d8d9fddb5b74b2c6245865544d5cf76ee16a3fca045bc028a48c51f8a290508a29b6013d014dc83',
            sigver: 1,
          },
        },
      ],
      user: {
        id: 2448,
        username:
          '050cd79763303bcc251bd489a6f7da823a2b8555402b01a7959ebca550d048600f',
        created_at: '2020-03-18T02:42:05.000Z',
        canonical_url: null,
        type: null,
        timezone: null,
        locale: null,
        avatar_image: {
          url: null,
          width: null,
          height: null,
          is_default: false,
        },
        cover_image: {
          url: null,
          width: null,
          height: null,
          is_default: false,
        },
        counts: {
          following: 0,
          posts: 0,
          followers: 0,
          stars: 0,
        },
        name: 'asdf',
        annotations: [],
      },
    },
  ],
};

class StubAppDotNetAPI extends OriginalAppDotNetApi {
  // make a request to the server
  async serverRequest(endpoint, options = {}) {
    const { method } = options;
    // console.warn('STUBBED ', method, ':', endpoint);

    if (
      endpoint === 'loki/v1/rss/messenger' ||
      endpoint === 'loki/v1/rss/loki'
    ) {
      return {
        statusCode: 200,
        response: {
          data: sampleFeed,
        },
      };
    }

    if (endpoint === 'channels/1/messages') {
      if (!method) {
        return {
          statusCode: 200,
          response: samplesGetMessages,
        };
      }
      return {
        statusCode: 200,
        response: {
          data: [],
          meta: {
            max_id: 0,
          },
        },
      };
    }

    if (
      endpoint === 'loki/v1/channel/1/deletes' ||
      endpoint === 'loki/v1/channel/1/moderators'
    ) {
      return {
        statusCode: 200,
        response: {
          data: [],
          meta: {
            max_id: 0,
          },
        },
      };
    }

    if (endpoint === 'channels/1') {
      let name = 'Unknown group';
      if (this.baseServerUrl.includes('/chat-dev.lokinet.org')) {
        name = 'Loki Dev Chat';
      } else if (this.baseServerUrl.includes('/chat.getsession.org')) {
        name = 'Session Public Chat';
      }
      return {
        statusCode: 200,
        response: {
          data: {
            annotations: [
              {
                type: 'net.patter-app.settings',
                value: {
                  name,
                },
              },
            ],
          },
        },
      };
    }
    if (endpoint === 'token') {
      return {
        statusCode: 200,
        response: {
          data: {
            user: {
              name: 'unknown name',
            },
          },
        },
      };
    }

    return {
      statusCode: 200,
      response: {},
    };
  }
}

module.exports = StubAppDotNetAPI;
