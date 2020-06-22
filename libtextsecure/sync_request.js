/* global Event, textsecure, window, libsession */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  async function SyncRequest() {

    // this.receiver = receiver;

    // this.oncontact = this.onContactSyncComplete.bind(this);
    // receiver.addEventListener('contactsync', this.oncontact);

    // this.ongroup = this.onGroupSyncComplete.bind(this);
    // receiver.addEventListener('groupsync', this.ongroup);

    const ourNumber = textsecure.storage.user.getNumber();

    window.log.info('SyncRequest created. Sending config sync request...');
    const { CONFIGURATION } = textsecure.protobuf.SyncMessage.Request.Type;
    const user = libsession.Types.PubKey.from(ourNumber);
    const { RequestSyncMessage } = window.libsession.Messages.Outgoing;

    const requestConfigurationSyncMessage = new RequestSyncMessage({
      timestamp: Date.now(),
      reqestType: CONFIGURATION,
    });
    await libsession.getMessageQueue().send(user, requestConfigurationSyncMessage);

    window.log.info('SyncRequest now sending contact sync message...');
    const { CONTACTS } = textsecure.protobuf.SyncMessage.Request.Type;
    const requestContactSyncMessage = new RequestSyncMessage({
      timestamp: Date.now(),
      reqestType: CONTACTS,
    });
    await libsession.getMessageQueue().send(user, requestContactSyncMessage);

    window.log.info('SyncRequest now sending group sync messsage...');
    const { GROUPS } = textsecure.protobuf.SyncMessage.Request.Type;
    const requestGroupSyncMessage = new RequestSyncMessage({
      timestamp: Date.now(),
      reqestType: GROUPS,
    });
    await libsession.getMessageQueue().send(user, requestGroupSyncMessage);

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

  textsecure.SyncRequest = function SyncRequestWrapper() {
    const syncRequest = new SyncRequest();
    this.addEventListener = syncRequest.addEventListener.bind(syncRequest);
    this.removeEventListener = syncRequest.removeEventListener.bind(
      syncRequest
    );
  };

  textsecure.SyncRequest.prototype = {
    constructor: textsecure.SyncRequest,
  };
})();
