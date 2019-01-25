// const fetch = require('node-fetch');

class LokiP2pAPI {
  constructor() {
    this.contactP2pDetails = {};
  }

  addContactP2pDetails(pubKey, address, port) {
    this.contactP2pDetails[pubKey] = {
      address,
      port,
    };
  }

  getContactP2pDetails(pubKey) {
    if (this.contactP2pDetails[pubKey]) {
      return this.contactP2pDetails[pubKey];
    }
    return null;
  }

  removeContactP2pDetails(pubKey, address, port) {
    this.contactP2pDetails[pubKey] = {
      address,
      port,
    };
  }
}

module.exports = {
  LokiP2pAPI,
};
