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
  Whisper.Deletes = new (Backbone.Collection.extend({
    forMessage(message) {
      const matchingDeletes = this.filter({
        targetSentTimestamp: message.get('sent_at'),
        fromId: message.getContact().get('id'),
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
        // The contact the delete message came from
        const fromContact = ConversationController.get(del.get('fromId'));

        if (!fromContact) {
          window.log.info(
            'No contact for DOE',
            del.get('fromId'),
            del.get('targetSentTimestamp')
          );

          return;
        }

        // Do not await, since this can deadlock the queue
        fromContact.queueJob(async () => {
          window.log.info('Handling DOE for', del.get('targetSentTimestamp'));

          const messages = await window.Signal.Data.getMessagesBySentAt(
            del.get('targetSentTimestamp'),
            {
              MessageCollection: Whisper.MessageCollection,
            }
          );

          const targetMessage = messages.find(m => {
            const messageContact = m.getContact();

            if (!messageContact) {
              return false;
            }

            // Find messages which are from the same contact who sent the DOE
            return messageContact.get('id') === fromContact.get('id');
          });

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
