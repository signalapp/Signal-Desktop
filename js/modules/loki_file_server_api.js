const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

const DEVICE_MAPPING_ANNOTATION_KEY = 'network.loki.messenger.devicemapping';


class LokiFileServerAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this._adnApi = new LokiAppDotNetAPI(ourKey);
  }

  async establishConnection(serverUrl) {
    this._server = await this._adnApi.findOrCreateServer(serverUrl);
    // TODO: Handle this failure gracefully
    if (!this._server) {
      // console.error('Failed to establish connection to file server');
    }
  }

  async getUserDeviceMapping(pubKey) {
    const annotations = await this._server.getUserAnnotations(pubKey);
    return annotations.find(
      annotation => annotation.type === DEVICE_MAPPING_ANNOTATION_KEY
    );
  }

  setOurDeviceMapping(authorisations, isPrimary) {
    const content = {
      isPrimary: isPrimary ? '1' : '0',
      authorisations,
    };
    return this._server.setSelfAnnotation(
      DEVICE_MAPPING_ANNOTATION_KEY,
      content
    );
  }
}

module.exports = LokiFileServerAPI;
