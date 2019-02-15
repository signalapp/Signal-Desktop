/* global setTimeout, clearTimeout */

const EventEmitter = require('events');

class LokiP2pAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.contactP2pDetails = {};
    this.ourKey = ourKey;
  }

  reset() {
    Object.keys(this.contactP2pDetails).forEach(key => {
      clearTimeout(this.contactP2pDetails[key].pingTimer);
      delete this.contactP2pDetails[key];
    });
  }

  updateContactP2pDetails(pubKey, address, port, isPing = false) {
    // Stagger the timers so the friends don't ping each other at the same time
    const timerDuration =
      pubKey < this.ourKey
        ? 60 * 1000 // 1 minute
        : 2 * 60 * 1000; // 2 minutes

    if (!this.contactP2pDetails[pubKey]) {
      // We didn't have this contact's details
      this.contactP2pDetails[pubKey] = {
        address,
        port,
        timerDuration,
        pingTimer: null,
        isOnline: false,
      };
      // Try ping
      this.pingContact(pubKey);
      return;
    }

    // We already had this contact's details
    const baseDetails = { ...this.contactP2pDetails[pubKey] };

    if (isPing) {
      // Received a ping
      // Update details in case they are new and mark online
      this.contactP2pDetails[pubKey].address = address;
      this.contactP2pDetails[pubKey].port = port;
      this.setContactOnline(pubKey);
      return;
    }

    // Received a storage broadcast message
    if (
      baseDetails.isOnline ||
      baseDetails.address !== address ||
      baseDetails.port !== port
    ) {
      // Had the contact marked as online and details we had were the same
      // Do nothing
      return;
    }

    // Had the contact marked as offline or got new details
    this.contactP2pDetails[pubKey].address = address;
    this.contactP2pDetails[pubKey].port = port;
    this.setContactOffline(pubKey);
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
    return !!(
      this.contactP2pDetails[pubKey] && this.contactP2pDetails[pubKey].isOnline
    );
  }

  pingContact(pubKey) {
    if (
      !this.contactP2pDetails[pubKey] ||
      this.contactP2pDetails[pubKey].isOnline
    ) {
      // Don't ping if we don't have their details or they are already online
      return;
    }
    this.emit('pingContact', pubKey);
  }
}

module.exports = LokiP2pAPI;
