/* global Whisper, i18n, lokiPublicChatAPI, ConversationController, friends */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConnectingToServerDialogView = Whisper.View.extend({
    templateName: 'connecting-to-server-template',
    className: 'loki-dialog connecting-to-server modal',
    initialize(options = {}) {
      this.title = i18n('connectingLoad');
      this.cancelText = options.cancelText || i18n('cancel');
      this.serverUrl = options.serverUrl;
      this.channelId = options.channelId;
      this.once('attemptConnection', () =>
        this.attemptConnection(options.serverUrl, options.channelId)
      );
      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .cancel': 'close',
    },
    async attemptConnection(serverUrl, channelId) {
      const rawServerUrl = serverUrl
        .replace(/^https?:\/\//i, '')
        .replace(/[/\\]+$/i, '');
      const sslServerUrl = `https://${rawServerUrl}`;
      const conversationId = `publicChat:${channelId}@${rawServerUrl}`;

      const conversationExists = ConversationController.get(conversationId);
      if (conversationExists) {
        // We are already a member of this public chat
        return this.resolveWith({ errorCode: i18n('publicChatExists') });
      }

      const serverAPI = await lokiPublicChatAPI.findOrCreateServer(
        sslServerUrl
      );
      if (!serverAPI) {
        // Url incorrect or server not compatible
        return this.resolveWith({ errorCode: i18n('connectToServerFail') });
      }

      const conversation = await ConversationController.getOrCreateAndWait(
        conversationId,
        'group'
      );
      await serverAPI.findOrCreateChannel(channelId, conversationId);
      await conversation.setPublicSource(sslServerUrl, channelId);
      await conversation.setFriendRequestStatus(
        friends.friendRequestStatusEnum.friends
      );
      return this.resolveWith({ conversation });
    },
    resolveWith(result) {
      this.trigger('connectionResult', result);
      this.remove();
    },
    render_attributes() {
      return {
        title: this.title,
        cancel: this.cancelText,
      };
    },
    close() {
      this.trigger('connectionResult', { cancelled: true });
      this.remove();
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Escape':
        case 'Esc':
          this.close();
          break;
        default:
          break;
      }
    },
  });
})();
