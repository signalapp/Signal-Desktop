/*
  global
  Backbone,
  _,
  BlockedNumberController
*/

/* eslint-disable no-proto */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  function SignalProtocolStore() {}

  SignalProtocolStore.prototype = {
    constructor: SignalProtocolStore,
    async removeAllData() {
      await window.Signal.Data.removeAll();

      window.storage.reset();
      await window.storage.fetch();

      window.getConversationController().reset();
      BlockedNumberController.reset();
      await window.getConversationController().load();
      await BlockedNumberController.load();
    },
  };
  _.extend(SignalProtocolStore.prototype, Backbone.Events);

  window.SignalProtocolStore = SignalProtocolStore;
})();
