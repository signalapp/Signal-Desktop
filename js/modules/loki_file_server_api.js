const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

/* global log */

const DEVICE_MAPPING_ANNOTATION_KEY = 'network.loki.messenger.devicemapping';

// returns the LokiFileServerAPI constructor with the serverUrl already consumed
function LokiFileServerAPIWrapper(serverUrl) {
  return LokiFileServerAPI.bind(null, serverUrl);
}

class LokiFileServerAPI {
  constructor(serverUrl, ourKey) {
    this.ourKey = ourKey;
    this._adnApi = new LokiAppDotNetAPI(ourKey);
    this._server = this._adnApi.findOrCreateServer(serverUrl);
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

  async uploadData(data) {
    const endpoint = 'files';
    const options = {
      method: 'POST',
      rawBody: data,
    };

    const { statusCode, response } = await this._server.serverRequest(
      endpoint,
      options
    );
    if (statusCode !== 200) {
      log.warn('Failed to upload data to fileserver');
      return null;
    }

    const url = response.data && response.data.url;
    return url;
  }
}

module.exports = LokiFileServerAPIWrapper;
