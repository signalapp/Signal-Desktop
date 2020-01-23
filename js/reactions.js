/* global
  Backbone,
  Whisper,
  MessageController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.Reactions = new (Backbone.Collection.extend({
    forMessage(message) {
      if (message.isOutgoing()) {
        const outgoingReaction = this.findWhere({
          targetTimestamp: message.get('sent_at'),
        });

        if (outgoingReaction) {
          window.log.info('Found early reaction for outgoing message');
          this.remove(outgoingReaction);
          return outgoingReaction;
        }
      }

      const reactionBySource = this.findWhere({
        targetAuthorE164: message.get('source'),
        targetTimestamp: message.get('sent_at'),
      });

      if (reactionBySource) {
        window.log.info('Found early reaction for message');
        this.remove(reactionBySource);
        return reactionBySource;
      }

      return null;
    },
    async onReaction(reaction) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          reaction.get('targetTimestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const targetMessage = messages.find(
          m =>
            m.get('source') === reaction.get('targetAuthorE164') ||
            // Outgoing messages don't have a source and are extremely unlikely
            // to have the same timestamp
            m.isOutgoing()
        );

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
