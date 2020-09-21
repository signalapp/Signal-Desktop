/* global dcodeIO */

const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

class LokiPushNotificationServerApi {
  constructor() {
    this.ourKey =
      '642a6585919742e5a2d4dc51244964fbcd8bcab2b75612407de58b810740d049';
    this.serverUrl = 'https://staging.apns.getsession.org';
    this._server = new LokiAppDotNetAPI(this.ourKey, this.serverUrl);

    // make sure pubKey & pubKeyHex are set in _server
    this.pubKey = this._server.getPubKeyForUrl();
  }

  async notify(plainTextBuffer, sentTo) {
    const options = {
      method: 'post',
      objBody: {
        data: dcodeIO.ByteBuffer.wrap(plainTextBuffer).toString('base64'),
        send_to: sentTo,
      },
    };
    return this._server.serverRequest('notify', options);
  }
}

module.exports = LokiPushNotificationServerApi;
