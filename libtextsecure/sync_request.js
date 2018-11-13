/* global Event, textsecure, window, ConversationController */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  function SyncRequest(sender, receiver) {
    if (
      !(sender instanceof textsecure.MessageSender) ||
      !(receiver instanceof textsecure.MessageReceiver)
    ) {
      throw new Error(
        'Tried to construct a SyncRequest without MessageSender and MessageReceiver'
      );
    }
    this.receiver = receiver;

    this.oncontact = this.onContactSyncComplete.bind(this);
    receiver.addEventListener('contactsync', this.oncontact);

    this.ongroup = this.onGroupSyncComplete.bind(this);
    receiver.addEventListener('groupsync', this.ongroup);

    const ourNumber = textsecure.storage.user.getNumber();
    const { wrap, sendOptions } = ConversationController.prepareForSend(
      ourNumber,
      { syncMessage: true }
    );
    window.log.info('SyncRequest created. Sending contact sync message...');
    wrap(sender.sendRequestContactSyncMessage(sendOptions))
      .then(() => {
        window.log.info('SyncRequest now sending group sync messsage...');
        return wrap(sender.sendRequestGroupSyncMessage(sendOptions));
      })
      .catch(error => {
        window.log.error(
          'SyncRequest error:',
          error && error.stack ? error.stack : error
        );
      });
    this.timeout = setTimeout(this.onTimeout.bind(this), 60000);
  }

  SyncRequest.prototype = new textsecure.EventTarget();
  SyncRequest.prototype.extend({
    constructor: SyncRequest,
    onContactSyncComplete() {
      this.contactSync = true;
      this.update();
    },
    onGroupSyncComplete() {
      this.groupSync = true;
      this.update();
    },
    update() {
      if (this.contactSync && this.groupSync) {
        this.dispatchEvent(new Event('success'));
        this.cleanup();
      }
    },
    onTimeout() {
      if (this.contactSync || this.groupSync) {
        this.dispatchEvent(new Event('success'));
      } else {
        this.dispatchEvent(new Event('timeout'));
      }
      this.cleanup();
    },
    cleanup() {
      clearTimeout(this.timeout);
      this.receiver.removeEventListener('contactsync', this.oncontact);
      this.receiver.removeEventListener('groupSync', this.ongroup);
      delete this.listeners;
    },
  });

  textsecure.SyncRequest = function SyncRequestWrapper(sender, receiver) {
    const syncRequest = new SyncRequest(sender, receiver);
    this.addEventListener = syncRequest.addEventListener.bind(syncRequest);
    this.removeEventListener = syncRequest.removeEventListener.bind(
      syncRequest
    );
  };

  textsecure.SyncRequest.prototype = {
    constructor: textsecure.SyncRequest,
  };
})();
