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

      signalProtocolStore.on('keychange', id => {
        ConversationController.getOrCreateAndWait(id, 'private').then(
          conversation => {
            conversation.addKeyChange(id);

            ConversationController.getAllGroupsInvolvingId(id).then(groups => {
              _.forEach(groups, group => {
                group.addKeyChange(id);
              });
            });
          }
        );
      });
    },
  };
})();
