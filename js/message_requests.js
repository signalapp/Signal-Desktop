// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global
  Backbone,
  Whisper,
  ConversationController,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};
  Whisper.MessageRequests = new (Backbone.Collection.extend({
    forConversation(conversation) {
      if (conversation.get('e164')) {
        const syncByE164 = this.findWhere({
          threadE164: conversation.get('e164'),
        });
        if (syncByE164) {
          window.log.info(
            `Found early message request response for E164 ${conversation.idForLogging()}`
          );
          this.remove(syncByE164);
          return syncByE164;
        }
      }

      if (conversation.get('uuid')) {
        const syncByUuid = this.findWhere({
          threadUuid: conversation.get('uuid'),
        });
        if (syncByUuid) {
          window.log.info(
            `Found early message request response for UUID ${conversation.idForLogging()}`
          );
          this.remove(syncByUuid);
          return syncByUuid;
        }
      }

      // V1 Group
      if (conversation.get('groupId')) {
        const syncByGroupId = this.findWhere({
          groupId: conversation.get('groupId'),
        });
        if (syncByGroupId) {
          window.log.info(
            `Found early message request response for group v1 ID ${conversation.idForLogging()}`
          );
          this.remove(syncByGroupId);
          return syncByGroupId;
        }
      }

      // V2 group
      if (conversation.get('groupId')) {
        const syncByGroupId = this.findWhere({
          groupV2Id: conversation.get('groupId'),
        });
        if (syncByGroupId) {
          window.log.info(
            `Found early message request response for group v2 ID ${conversation.idForLogging()}`
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
        const groupV2Id = sync.get('groupV2Id');

        let conversation;

        // We multiplex between GV1/GV2 groups here, but we don't kick off migrations
        if (groupV2Id) {
          conversation = ConversationController.get(groupV2Id);
        }
        if (!conversation && groupId) {
          conversation = ConversationController.get(groupId);
        }
        if (!conversation && (threadE164 || threadUuid)) {
          conversation = ConversationController.get(
            ConversationController.ensureContactIds({
              e164: threadE164,
              uuid: threadUuid,
            })
          );
        }

        if (!conversation) {
          window.log(
            `Received message request response for unknown conversation: groupv2(${groupV2Id}) group(${groupId}) ${threadUuid} ${threadE164}`
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
