/* eslint-disable class-methods-use-this */

const EventEmitter = require('events');
const Mixpanel = require('mixpanel');
// require('setimmediate');

class LokiMixpanelAPI extends EventEmitter {
  constructor() {
    super();
    this.mixpanel = Mixpanel.init('736cd9a854a157591153efacd1164e9a');
  }
  track(label) {
    this.mixpanel.track(label);
  }
}

module.exports = LokiMixpanelAPI;
