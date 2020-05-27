/* global
  Backbone,
  Whisper,
  ConversationController,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.MessageRequests = new (Backbone.Collection.extend({
    forConversation(conversation) {
      if (conversation.get('e164')) {
        const syncByE164 = this.findWhere({
          e164: conversation.get('e164'),
        });
        if (syncByE164) {
          window.log.info(
            `Found early message request response for E164 ${conversation.get(
              'e164'
            )}`
          );
          this.remove(syncByE164);
          return syncByE164;
        }
      }

      if (conversation.get('uuid')) {
        const syncByUuid = this.findWhere({
          uuid: conversation.get('uuid'),
        });
        if (syncByUuid) {
          window.log.info(
            `Found early message request response for UUID ${conversation.get(
              'uuid'
            )}`
          );
          this.remove(syncByUuid);
          return syncByUuid;
        }
      }

      if (conversation.get('groupId')) {
        const syncByGroupId = this.findWhere({
          uuid: conversation.get('groupId'),
        });
        if (syncByGroupId) {
          window.log.info(
            `Found early message request response for GROUP ID ${conversation.get(
              'groupId'
            )}`
          );
          this.remove(syncByGroupId);
          return syncByGroupId;
        }
      }

      return null;
    },
    async onResponse(sync) {
      try {
        const threadE164 = sync.get('threadE164');
        const threadUuid = sync.get('threadUuid');
        const groupId = sync.get('groupId');
        const identifier = threadE164 || threadUuid || groupId;
        const conversation = ConversationController.get(identifier);

        if (!conversation) {
          window.log(
            `Received message request response for unknown conversation: ${identifier}`
          );
          return;
        }

        conversation.applyMessageRequestResponse(sync.get('type'), {
          fromSync: true,
        });

        this.remove(sync);
      } catch (error) {
        window.log.error(
          'MessageRequests.onResponse error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
