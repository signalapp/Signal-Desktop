var FakeWhisperAPI = function() {

  this.doAjax = function(param) {
    if (param.success_callback) {
      setTimeout(param.success_callback, 100, param.response);
    }
  }

  this.getKeysForNumber = function(number, success_callback, error_callback) {
    this.doAjax({ success_callback: success_callback,
                  response        : [{ identityKey: 1,
                                       deviceId   : 1,
                                       publicKey  : 1,
                                       keyId      : 1 }]
    });
  }

  this.sendMessages = function(jsonData, success_callback, error_callback) {
    this.doAjax({ success_callback: success_callback,
                  response        : { missingDeviceIds: [] }
    });
  }
};

FakeWhisperAPI.prototype = API;
API = new FakeWhisperAPI();

