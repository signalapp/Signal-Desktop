/* global
  Backbone,
  Whisper,
  MessageController,
  ConversationController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};
  Whisper.Deletes = new (Backbone.Collection.extend({
    forMessage(message) {
      const matchingDeletes = this.filter({
        targetSentTimestamp: message.get('sent_at'),
        fromId: message.getContactId(),
      });

      if (matchingDeletes.length > 0) {
        window.log.info('Found early DOE for message');
        this.remove(matchingDeletes);
        return matchingDeletes;
      }

      return [];
    },
    async onDelete(del) {
      try {
        // The conversation the deleted message was in; we have to find it in the database
        //   to to figure that out.
        const targetConversation = await ConversationController.getConversationForTargetMessage(
          del.get('fromId'),
          del.get('targetSentTimestamp')
        );

        if (!targetConversation) {
          window.log.info(
            'No target conversation for DOE',
            del.get('fromId'),
            del.get('targetSentTimestamp')
          );

          return;
        }

        // Do not await, since this can deadlock the queue
        targetConversation.queueJob(async () => {
          window.log.info('Handling DOE for', del.get('targetSentTimestamp'));

          const messages = await window.Signal.Data.getMessagesBySentAt(
            del.get('targetSentTimestamp'),
            {
              MessageCollection: Whisper.MessageCollection,
            }
          );

          const targetMessage = messages.find(
            m => del.get('fromId') === m.getContactId()
          );

          if (!targetMessage) {
            window.log.info(
              'No message for DOE',
              del.get('fromId'),
              del.get('targetSentTimestamp')
            );

            return;
          }

          const message = MessageController.register(
            targetMessage.id,
            targetMessage
          );

          await window.Signal.Util.deleteForEveryone(message, del);

          this.remove(del);
        });
      } catch (error) {
        window.log.error(
          'Deletes.onDelete error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
