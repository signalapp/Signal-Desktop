/* global Whisper, SignalProtocolStore, ConversationController, _ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};

  Whisper.KeyChangeListener = {
    init(signalProtocolStore) {
      if (!(signalProtocolStore instanceof SignalProtocolStore)) {
        throw new Error('KeyChangeListener requires a SignalProtocolStore');
      }

      signalProtocolStore.on('keychange', async identifier => {
        const conversation = await ConversationController.getOrCreateAndWait(
          identifier,
          'private'
        );
        conversation.addKeyChange(identifier);

        const groups = await ConversationController.getAllGroupsInvolvingId(
          conversation.id
        );
        _.forEach(groups, group => {
          group.addKeyChange(identifier);
        });
      });
    },
  };
})();
