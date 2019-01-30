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
    return this.contactP2pDetails[pubKey] || null;
  }

  removeContactP2pDetails(pubKey) {
    delete this.contactP2pDetails[pubKey];
  }
}

module.exports = {
  LokiP2pAPI,
};
