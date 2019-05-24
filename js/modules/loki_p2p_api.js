/* global setTimeout, clearTimeout */

const EventEmitter = require('events');
const { isEmpty } = require('lodash');

const offlinePingTime = 2 * 60 * 1000; // 2 minutes

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

  updateContactP2pDetails(pubKey, address, port, isP2PMessage = false) {
    // Stagger the timers so the friends don't ping each other at the same time
    const timerDuration =
      pubKey < this.ourKey
        ? 60 * 1000 // 1 minute
        : 2 * 60 * 1000; // 2 minutes

    // Get the current contact details
    // This will be empty if we don't have them
    const baseDetails = { ...(this.contactP2pDetails[pubKey] || {}) };

    // Always set the new contact details
    this.contactP2pDetails[pubKey] = {
      address,
      port,
      timerDuration,
      pingTimer: null,
      isOnline: false,
    };

    const contactExists = !isEmpty(baseDetails);
    const { isOnline } = baseDetails;
    const detailsChanged =
      baseDetails.address !== address || baseDetails.port !== port;

    // If we had the contact details
    // And we got a P2P message
    // And the contact was online
    // And the new details that we got matched the old
    // Then we don't need to bother pinging
    if (contactExists && isP2PMessage && isOnline && !detailsChanged) {
      // We also need to set the current contact details to show online
      //  because they get reset to `false` above
      this.setContactOnline(pubKey);
      return;
    }

    /*
      Ping the contact.
      This happens in the following scenarios:
        1. We didn't have the contact, we need to ping them to let them know our details.
        2. isP2PMessage = false, so we assume the contact doesn't have our details.
        3. We had the contact marked as offline,
            we need to make sure that we can reach their server.
        4. The other contact details have changed,
            we need to make sure that we can reach their new server.
    */
    this.pingContact(pubKey);
  }

  getContactP2pDetails(pubKey) {
    if (!this.contactP2pDetails[pubKey]) return null;
    return { ...this.contactP2pDetails[pubKey] };
  }

  isContactOnline(pubKey) {
    const contactDetails = this.contactP2pDetails[pubKey];
    return !!(contactDetails && contactDetails.isOnline);
  }

  setContactOffline(pubKey) {
    this.emit('offline', pubKey);
    if (!this.contactP2pDetails[pubKey]) {
      return;
    }
    clearTimeout(this.contactP2pDetails[pubKey].pingTimer);
    this.contactP2pDetails[pubKey].pingTimer = setTimeout(
      this.pingContact.bind(this),
      offlinePingTime,
      pubKey
    );
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
    if (!this.contactP2pDetails[pubKey]) {
      // Don't ping if we don't have their details
      return;
    }
    this.emit('pingContact', pubKey);
  }
}

module.exports = LokiP2pAPI;
