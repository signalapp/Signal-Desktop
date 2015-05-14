function AxolotlStore() {
	this.store = {};
}

AxolotlStore.prototype = {
	getMyIdentityKey: function() {
		return Promise.resolve(this.get('identityKey'));
	},
	getMyRegistrationId: function() {
		return Promise.resolve(this.get('registrationId'));
	},
	put: function(key, value) {
		if (key === undefined || value === undefined || key === null || value === null)
			throw new Error("Tried to store undefined/null");
		this.store[key] = value;
	},
	get: function(key, defaultValue) {
		if (key === null || key === undefined)
			throw new Error("Tried to get value for undefined/null key");
		if (key in this.store) {
			return this.store[key];
		} else {
			return defaultValue;
		}
	},
	remove: function(key) {
		if (key === null || key === undefined)
			throw new Error("Tried to remove value for undefined/null key");
		delete this.store[key];
	},

	getIdentityKey: function(identifier) {
		if (identifier === null || identifier === undefined)
			throw new Error("Tried to get identity key for undefined/null key");
		return new Promise(function(resolve) {
			resolve(this.get('identityKey' + identifier));
		}.bind(this));
	},
	putIdentityKey: function(identifier, identityKey) {
		if (identifier === null || identifier === undefined)
			throw new Error("Tried to put identity key for undefined/null key");
		return new Promise(function(resolve) {
			resolve(this.put('identityKey' + identifier, identityKey));
		}.bind(this));
	},

	/* Returns a prekeypair object or undefined */
	getPreKey: function(keyId) {
		return new Promise(function(resolve) {
			var res = this.get('25519KeypreKey' + keyId);
			resolve(res);
		}.bind(this));
	},
	putPreKey: function(keyId, keyPair) {
		return new Promise(function(resolve) {
			resolve(this.put('25519KeypreKey' + keyId, keyPair));
		}.bind(this));
	},
	removePreKey: function(keyId) {
		return new Promise(function(resolve) {
			resolve(this.remove('25519KeypreKey' + keyId));
		}.bind(this));
	},

	/* Returns a signed keypair object or undefined */
	getSignedPreKey: function(keyId) {
		return new Promise(function(resolve) {
			var res = this.get('25519KeysignedKey' + keyId);
			resolve(res);
		}.bind(this));
	},
	putSignedPreKey: function(keyId, keyPair) {
		return new Promise(function(resolve) {
			resolve(this.put('25519KeysignedKey' + keyId, keyPair));
		}.bind(this));
	},
	removeSignedPreKey: function(keyId) {
		return new Promise(function(resolve) {
			resolve(this.remove('25519KeysignedKey' + keyId));
		}.bind(this));
	},

	getSession: function(identifier) {
		return new Promise(function(resolve) {
			resolve(this.get('session' + identifier));
		}.bind(this));
	},
	putSession: function(identifier, record) {
		return new Promise(function(resolve) {
			resolve(this.put('session' + identifier, record));
		}.bind(this));
	},
  removeAllSessions: function(identifier) {
		return new Promise(function(resolve) {
      for (key in this.store) {
        if (key.match(RegExp('^session' + identifier.replace('\+','\\\+') + '.+'))) {
          delete this.store[key];
        }
      }
      resolve();
    }.bind(this));
  },
  getDeviceIds: function(identifier) {
		return new Promise(function(resolve) {
      var deviceIds = [];
      for (key in this.store) {
        if (key.match(RegExp('^session' + identifier.replace('\+','\\\+') + '.+'))) {
          deviceIds.push(parseInt(key.split('.')[1]));
        }
      }
      resolve(deviceIds);
    }.bind(this));
  }
};
