/* global setTimeout, clearTimeout, window */

const EventEmitter = require('events');

class LokiP2pAPI extends EventEmitter {
  constructor() {
    super();
    this.contactP2pDetails = {};
  }

  addContactP2pDetails(pubKey, address, port, resetTimer = false) {
    // Stagger the timers so the friends don't ping each other at the same time
    this.ourKey = this.ourKey || window.textsecure.storage.user.getNumber();
    const timerDuration =
      pubKey < this.ourKey
        ? 60 * 1000 // 1 minute
        : 2 * 60 * 1000; // 2 minutes

    if (this.contactP2pDetails[pubKey] && this.contactP2pDetails[pubKey].pingTimer) {
      clearTimeout(this.contactP2pDetails[pubKey].pingTimer);
    }
    this.contactP2pDetails[pubKey] = {
      address,
      port,
      timerDuration,
      isOnline: false,
      pingTimer: null,
    };
    if (resetTimer) {
      // If this contact is simply sharing the same details with us
      // then we just reset our timer
      this.contactP2pDetails[pubKey].pingTimer = setTimeout(
        this.pingContact.bind(this),
        this.contactP2pDetails[pubKey].timerDuration,
        pubKey
      );
      return;
    }
    this.pingContact(pubKey);
  }

  getContactP2pDetails(pubKey) {
    return this.contactP2pDetails[pubKey] || null;
  }

  setContactOffline(pubKey) {
    this.emit('offline', pubKey);
    if (!this.contactP2pDetails[pubKey]) {
      return;
    }
    clearTimeout(this.contactP2pDetails[pubKey].pingTimer);
    this.contactP2pDetails[pubKey].isOnline = false;
  }

  setContactOnline(pubKey) {
    if (!this.contactP2pDetails[pubKey]) {
      return;
    }
    this.emit('online', pubKey);
    clearTimeout(this.contactP2pDetails[pubKey].pingTimer);
    this.contactP2pDetails[pubKey].isOnline = true;
    this.contactP2pDetails[pubKey].pingTimer = setTimeout(
      this.pingContact.bind(this),
      this.contactP2pDetails[pubKey].timerDuration,
      pubKey
    );
  }

  isOnline(pubKey) {
    return !!(this.contactP2pDetails[pubKey] && this.contactP2pDetails[pubKey].isOnline);
  }

  pingContact(pubKey) {
    if (!this.contactP2pDetails[pubKey]) {
      return;
    }
    window.libloki.api.sendOnlineBroadcastMessage(pubKey, true);
  }
}

module.exports = LokiP2pAPI;
