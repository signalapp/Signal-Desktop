/* global Whisper, SignalProtocolStore, ConversationController, _ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.KeyChangeListener = {
    init(signalProtocolStore) {
      if (!(signalProtocolStore instanceof SignalProtocolStore)) {
        throw new Error('KeyChangeListener requires a SignalProtocolStore');
      }

      signalProtocolStore.on('keychange', async id => {
        const conversation = await ConversationController.getOrCreateAndWait(
          id,
          'private'
        );
        conversation.addKeyChange(id);

        const groups = await ConversationController.getAllGroupsInvolvingId(id);
        _.forEach(groups, group => {
          group.addKeyChange(id);
        });
      });
    },
  };
})();
