/* global
  Backbone,
  Whisper,
  MessageController,
  ConversationController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.Reactions = new (Backbone.Collection.extend({
    forMessage(message) {
      if (message.isOutgoing()) {
        const outgoingReactions = this.filter({
          targetTimestamp: message.get('sent_at'),
        });

        if (outgoingReactions.length > 0) {
          window.log.info('Found early reaction for outgoing message');
          this.remove(outgoingReactions);
          return outgoingReactions;
        }
      }

      const reactionsBySource = this.filter(re => {
        const mcid = message.get('conversationId');
        const recid = ConversationController.getConversationId(
          re.get('targetAuthorE164') || re.get('targetAuthorUuid')
        );
        const mTime = message.get('sent_at');
        const rTime = re.get('targetTimestamp');
        return mcid === recid && mTime === rTime;
      });

      if (reactionsBySource.length > 0) {
        window.log.info('Found early reaction for message');
        this.remove(reactionsBySource);
        return reactionsBySource;
      }

      return [];
    },
    async onReaction(reaction) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          reaction.get('targetTimestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const targetMessage = messages.find(m => {
          const mcid = m.isOutgoing()
            ? ConversationController.getOurConversationId()
            : m.get('conversationId');
          const recid = ConversationController.getConversationId(
            reaction.get('targetAuthorE164') || reaction.get('targetAuthorUuid')
          );
          return mcid === recid;
        });

        if (!targetMessage) {
          window.log.info(
            'No message for reaction',
            reaction.get('targetAuthorE164'),
            reaction.get('targetAuthorUuid'),
            reaction.get('targetTimestamp')
          );

          // Since we haven't received the message for which we are removing a
          // reaction, we can just remove those pending reaction
          if (reaction.get('remove')) {
            this.remove(reaction);
            const oldReaction = this.where({
              targetAuthorE164: reaction.get('targetAuthorE164'),
              targetAuthorUuid: reaction.get('targetAuthorUuid'),
              targetTimestamp: reaction.get('targetTimestamp'),
              emoji: reaction.get('emoji'),
            });
            oldReaction.forEach(r => this.remove(r));
          }

          return;
        }

        const message = MessageController.register(
          targetMessage.id,
          targetMessage
        );

        await message.handleReaction(reaction);

        this.remove(reaction);
      } catch (error) {
        window.log.error(
          'Reactions.onReaction error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
