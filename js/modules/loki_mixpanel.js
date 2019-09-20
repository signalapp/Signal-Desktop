const Mixpanel = require('mixpanel');

class LokiMixpanelAPI {
  constructor() {
    this.mixpanel = Mixpanel.init('736cd9a854a157591153efacd1164e9a');
  }
  track(label) {
    this.mixpanel.track(label);
  }
}

module.exports = LokiMixpanelAPI;
