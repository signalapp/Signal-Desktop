/* global
  Backbone,
  Whisper,
  ConversationController,
  MessageController,
  _
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};

  Whisper.DeliveryReceipts = new (Backbone.Collection.extend({
    forMessage(conversation, message) {
      let recipients;
      if (conversation.isPrivate()) {
        recipients = [conversation.id];
      } else {
        recipients = conversation.get('members') || [];
      }
      const receipts = this.filter(
        receipt =>
          receipt.get('timestamp') === message.get('sent_at') &&
          recipients.indexOf(receipt.get('deliveredTo')) > -1
      );
      this.remove(receipts);
      return receipts;
    },
    async getTargetMessage(sourceId, messages) {
      if (messages.length === 0) {
        return null;
      }
      const message = messages.find(
        item => !item.isIncoming() && sourceId === item.get('conversationId')
      );
      if (message) {
        return MessageController.register(message.id, message);
      }

      const groups = await window.Signal.Data.getAllGroupsInvolvingId(
        sourceId,
        {
          ConversationCollection: Whisper.ConversationCollection,
        }
      );

      const ids = groups.pluck('id');
      ids.push(sourceId);

      const target = messages.find(
        item =>
          !item.isIncoming() && _.contains(ids, item.get('conversationId'))
      );
      if (!target) {
        return null;
      }

      return MessageController.register(target.id, target);
    },
    async onReceipt(receipt) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          receipt.get('timestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const message = await this.getTargetMessage(
          receipt.get('deliveredTo'),
          messages
        );
        if (!message) {
          window.log.info(
            'No message for delivery receipt',
            receipt.get('deliveredTo'),
            receipt.get('timestamp')
          );
          return;
        }

        const deliveries = message.get('delivered') || 0;
        const deliveredTo = message.get('delivered_to') || [];
        const expirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );
        message.set({
          delivered_to: _.union(deliveredTo, [receipt.get('deliveredTo')]),
          delivered: deliveries + 1,
          expirationStartTimestamp: expirationStartTimestamp || Date.now(),
          sent: true,
        });

        if (message.isExpiring() && !expirationStartTimestamp) {
          await message.setToExpire(false, { skipSave: true });
        }

        await window.Signal.Data.saveMessage(message.attributes, {
          Message: Whisper.Message,
        });

        // notify frontend listeners
        const conversation = ConversationController.get(
          message.get('conversationId')
        );
        if (conversation) {
          conversation.trigger('delivered', message);
        }

        this.remove(receipt);
      } catch (error) {
        window.log.error(
          'DeliveryReceipts.onReceipt error:',
          error && error.stack ? error.stack : error
        );
      }
    },
  }))();
})();
