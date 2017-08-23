/*
 * vim: ts=4:sw=4:expandtab
 */

var TextSecureServer = (function() {
    'use strict';

    function validateResponse(response, schema) {
        try {
            for (var i in schema) {
                switch (schema[i]) {
                    case 'object':
                    case 'string':
                    case 'number':
                        if (typeof response[i] !== schema[i]) {
                            return false;
                        }
                        break;
                }
            }
        } catch(ex) {
            return false;
        }
        return true;
    }

    function createSocket(url) {
      var requestOptions = { ca: window.config.certificateAuthorities };
      return new nodeWebSocket(url, null, null, null, requestOptions);
    }

    var XMLHttpRequest = nodeXMLHttpRequest;
    window.setImmediate = nodeSetImmediate;

    // Promise-based async xhr routine
    function promise_ajax(url, options) {
        return new Promise(function (resolve, reject) {
            if (!url) {
                url = options.host +  '/' + options.path;
            }
            console.log(options.type, url);
            var xhr = new XMLHttpRequest();
            xhr.open(options.type, url, true /*async*/);

            if ( options.responseType ) {
                xhr[ 'responseType' ] = options.responseType;
            }
            if (options.user && options.password) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(options.user) + ":" + getString(options.password)));
            }
            if (options.contentType) {
                xhr.setRequestHeader( "Content-Type", options.contentType );
            }
            xhr.setRequestHeader( 'X-Signal-Agent', 'OWD' );

            if (options.certificateAuthorities) {
              xhr.setCertificateAuthorities(options.certificateAuthorities);
            }

            xhr.onload = function() {
                var result = xhr.response;
                if ( (!xhr.responseType || xhr.responseType === "text") &&
                        typeof xhr.responseText === "string" ) {
                    result = xhr.responseText;
                }
                if (options.dataType === 'json') {
                    try { result = JSON.parse(xhr.responseText + ''); } catch(e) {}
                    if (options.validateResponse) {
                        if (!validateResponse(result, options.validateResponse)) {
                            console.log(options.type, url, xhr.status, 'Error');
                            reject(HTTPError(xhr.status, result, options.stack));
                        }
                    }
                }
                if ( 0 <= xhr.status && xhr.status < 400) {
                    console.log(options.type, url, xhr.status, 'Success');
                    resolve(result, xhr.status);
                } else {
                    console.log(options.type, url, xhr.status, 'Error');
                    reject(HTTPError(xhr.status, result, options.stack));
                }
            };
            xhr.onerror = function() {
                console.log(options.type, url, xhr.status, 'Error');
                console.log(xhr.statusText);
                reject(HTTPError(xhr.status, xhr.statusText, options.stack));
            };
            xhr.send( options.data || null );
        });
    }

    function retry_ajax(url, options, limit, count) {
        count = count || 0;
        limit = limit || 3;
        count++;
        return promise_ajax(url, options).catch(function(e) {
            if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve(retry_ajax(url, options, limit, count));
                    }, 1000);
                });
            } else {
                throw e;
            }
        });
    }

    function ajax(url, options) {
        options.stack = new Error().stack; // just in case, save stack here.
        return retry_ajax(url, options);
    }

    function HTTPError(code, response, stack) {
        if (code > 999 || code < 100) {
            code = -1;
        }
        var e = new Error();
        e.name     = 'HTTPError';
        e.code     = code;
        e.stack    = stack;
        if (response) {
            e.response = response;
        }
        return e;
    }

    var URL_CALLS = {
        accounts   : "v1/accounts",
        devices    : "v1/devices",
        keys       : "v2/keys",
        signed     : "v2/keys/signed",
        messages   : "v1/messages",
        attachment : "v1/attachments",
        profile    : "v1/profile"
    };

    function TextSecureServer(url, username, password, cdn_url) {
        if (typeof url !== 'string') {
            throw new Error('Invalid server url');
        }
        this.url = url;
        this.cdn_url = cdn_url;
        this.username = username;
        this.password = password;
    }

    TextSecureServer.prototype = {
        constructor: TextSecureServer,
        ajax: function(param) {
            if (!param.urlParameters) {
                param.urlParameters = '';
            }
            return ajax(null, {
                    host        : this.url,
                    path        : URL_CALLS[param.call] + param.urlParameters,
                    type        : param.httpType,
                    data        : param.jsonData && textsecure.utils.jsonThing(param.jsonData),
                    contentType : 'application/json; charset=utf-8',
                    dataType    : 'json',
                    user        : this.username,
                    password    : this.password,
                    validateResponse: param.validateResponse,
                    certificateAuthorities: window.config.certificateAuthorities
            }).catch(function(e) {
                var code = e.code;
                if (code === 200) {
                    // happens sometimes when we get no response
                    // (TODO: Fix server to return 204? instead)
                    return null;
                }
                var message;
                switch (code) {
                case -1:
                    message = "Failed to connect to the server, please check your network connection.";
                    break;
                case 413:
                    message = "Rate limit exceeded, please try again later.";
                    break;
                case 403:
                    message = "Invalid code, please try again.";
                    break;
                case 417:
                    // TODO: This shouldn't be a thing?, but its in the API doc?
                    message = "Number already registered.";
                    break;
                case 401:
                    message = "Invalid authentication, most likely someone re-registered and invalidated our registration.";
                    break;
                case 404:
                    message = "Number is not registered.";
                    break;
                default:
                    message = "The server rejected our query, please file a bug report.";
                }
                e.message = message
                throw e;
            });
        },
        getProfile: function(number) {
            return this.ajax({
                call                : 'profile',
                httpType            : 'GET',
                urlParameters       : '/' + number,
            });
        },
        getAvatar: function(path) {
            return ajax(this.cdn_url + '/' + path, {
                type        : "GET",
                responseType: "arraybuffer",
                contentType : "application/octet-stream",
                certificateAuthorities: window.config.certificateAuthorities
            });
        },
        requestVerificationSMS: function(number) {
            return this.ajax({
                call                : 'accounts',
                httpType            : 'GET',
                urlParameters       : '/sms/code/' + number,
            });
        },
        requestVerificationVoice: function(number) {
            return this.ajax({
                call                : 'accounts',
                httpType            : 'GET',
                urlParameters       : '/voice/code/' + number,
            });
        },
        confirmCode: function(number, code, password, signaling_key, registrationId, deviceName) {
            var jsonData = {
                signalingKey    : btoa(getString(signaling_key)),
                supportsSms     : false,
                fetchesMessages : true,
                registrationId  : registrationId,
            };

            var call, urlPrefix, schema;
            if (deviceName) {
                jsonData.name = deviceName;
                call = 'devices';
                urlPrefix = '/';
                schema = { deviceId: 'number' };
            } else {
                call = 'accounts';
                urlPrefix = '/code/';
            }

            this.username = number;
            this.password = password;
            return this.ajax({
                call                : call,
                httpType            : 'PUT',
                urlParameters       : urlPrefix + code,
                jsonData            : jsonData,
                validateResponse    : schema
            });
        },
        getDevices: function(number) {
            return this.ajax({
                call     : 'devices',
                httpType : 'GET',
            });
        },
        registerKeys: function(genKeys) {
            var keys = {};
            keys.identityKey = btoa(getString(genKeys.identityKey));
            keys.signedPreKey = {
                keyId: genKeys.signedPreKey.keyId,
                publicKey: btoa(getString(genKeys.signedPreKey.publicKey)),
                signature: btoa(getString(genKeys.signedPreKey.signature))
            };

            keys.preKeys = [];
            var j = 0;
            for (var i in genKeys.preKeys) {
                keys.preKeys[j++] = {
                    keyId: genKeys.preKeys[i].keyId,
                    publicKey: btoa(getString(genKeys.preKeys[i].publicKey))
                };
            }

            // This is just to make the server happy
            // (v2 clients should choke on publicKey)
            keys.lastResortKey = {keyId: 0x7fffFFFF, publicKey: btoa("42")};

            return this.ajax({
                call                : 'keys',
                httpType            : 'PUT',
                jsonData            : keys,
            });
        },
        setSignedPreKey: function(signedPreKey) {
            return this.ajax({
                call                : 'signed',
                httpType            : 'PUT',
                jsonData            : {
                    keyId: signedPreKey.keyId,
                    publicKey: btoa(getString(signedPreKey.publicKey)),
                    signature: btoa(getString(signedPreKey.signature))
                }
            });
        },
        getMyKeys: function(number, deviceId) {
            return this.ajax({
                call                : 'keys',
                httpType            : 'GET',
                validateResponse    : {count: 'number'}
            }).then(function(res) {
                return res.count;
            });
        },
        getKeysForNumber: function(number, deviceId) {
            if (deviceId === undefined)
                deviceId = "*";

            return this.ajax({
                call                : 'keys',
                httpType            : 'GET',
                urlParameters       : "/" + number + "/" + deviceId,
                validateResponse    : {identityKey: 'string', devices: 'object'}
            }).then(function(res) {
                if (res.devices.constructor !== Array) {
                    throw new Error("Invalid response");
                }
                res.identityKey = StringView.base64ToBytes(res.identityKey);
                res.devices.forEach(function(device) {
                    if ( !validateResponse(device, {signedPreKey: 'object'}) ||
                         !validateResponse(device.signedPreKey, {publicKey: 'string', signature: 'string'}) ) {
                        throw new Error("Invalid signedPreKey");
                    }
                    if ( device.preKey ) {
                        if ( !validateResponse(device, {preKey: 'object'}) ||
                             !validateResponse(device.preKey, {publicKey: 'string'})) {
                            throw new Error("Invalid preKey");
                        }
                        device.preKey.publicKey = StringView.base64ToBytes(device.preKey.publicKey);
                    }
                    device.signedPreKey.publicKey = StringView.base64ToBytes(device.signedPreKey.publicKey);
                    device.signedPreKey.signature = StringView.base64ToBytes(device.signedPreKey.signature);
                });
                return res;
            });
        },
        sendMessages: function(destination, messageArray, timestamp) {
            var jsonData = { messages: messageArray, timestamp: timestamp};

            return this.ajax({
                call                : 'messages',
                httpType            : 'PUT',
                urlParameters       : '/' + destination,
                jsonData            : jsonData,
            });
        },
        getAttachment: function(id) {
            return this.ajax({
                call                : 'attachment',
                httpType            : 'GET',
                urlParameters       : '/' + id,
                validateResponse    : {location: 'string'}
            }).then(function(response) {
                return ajax(response.location, {
                    type        : "GET",
                    responseType: "arraybuffer",
                    contentType : "application/octet-stream"
                });
            }.bind(this));
        },
        putAttachment: function(encryptedBin) {
            return this.ajax({
                call     : 'attachment',
                httpType : 'GET',
            }).then(function(response) {
                return ajax(response.location, {
                    type        : "PUT",
                    contentType : "application/octet-stream",
                    data        : encryptedBin,
                    processData : false,
                }).then(function() {
                    return response.idString;
                }.bind(this));
            }.bind(this));
        },
        getMessageSocket: function() {
            console.log('opening message socket', this.url);
            return createSocket(this.url.replace('https://', 'wss://').replace('http://', 'ws://')
                    + '/v1/websocket/?login=' + encodeURIComponent(this.username)
                    + '&password=' + encodeURIComponent(this.password)
                    + '&agent=OWD');
        },
        getProvisioningSocket: function () {
            console.log('opening provisioning socket', this.url);
            return createSocket(this.url.replace('https://', 'wss://').replace('http://', 'ws://')
                    + '/v1/websocket/provisioning/?agent=OWD');
        }
    };

    return TextSecureServer;
})();
