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

    // Promise-based async xhr routine
    function promise_ajax(url, options) {
        return new Promise(function (resolve, reject) {
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
                            reject(new Error('Invalid response'));
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
                reject(HTTPError(xhr.status, null, options.stack));
            };
            xhr.send( options.data || null );
        });
    }

    function ajax(url, options) {
        options.stack = new Error().stack; // just in case, save stack here.
        var count = 3;

        function retry(e) {
            if (e.name === 'HTTPError' && e.code === -1 && count > 0) {
                count = count - 1;
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve(promise_ajax(url, options).catch(retry));
                    }, 1000 );
                });
            } else {
                throw e;
            }
        }

        return promise_ajax(url, options).catch(retry);
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
        accounts   : "/v1/accounts",
        devices    : "/v1/devices",
        keys       : "/v2/keys",
        messages   : "/v1/messages",
        attachment : "/v1/attachments"
    };

    function TextSecureServer(url, username, password, attachment_server_url) {
        if (typeof url !== 'string') {
            throw new Error('Invalid server url');
        }
        this.url = url;
        this.username = username;
        this.password = password;

        this.attachment_id_regex = RegExp("^https:\/\/.*\/(\\d+)\?");
        if (attachment_server_url) {
            // strip trailing /
            attachment_server_url = attachment_server_url.replace(/\/$/,'');
            // and escape
            attachment_server_url = attachment_server_url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            this.attachment_id_regex = RegExp( "^" + attachment_server_url + "\/(\\d+)\?");
        }


    }

    TextSecureServer.prototype = {
        constructor: TextSecureServer,
        ajax: function(param) {
            if (!param.urlParameters) {
                param.urlParameters = '';
            }
            return ajax(this.url + URL_CALLS[param.call] + param.urlParameters, {
                    type        : param.httpType,
                    data        : param.jsonData && textsecure.utils.jsonThing(param.jsonData),
                    contentType : 'application/json; charset=utf-8',
                    dataType    : 'json',
                    user        : this.username,
                    password    : this.password,
                    validateResponse: param.validateResponse
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
                case 403:
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
                for (var i = 0; i < res.devices.length; i++) {
                    if ( !validateResponse(res.devices[i], {signedPreKey: 'object', preKey: 'object'}) ||
                         !validateResponse(res.devices[i].signedPreKey, {publicKey: 'string', signature: 'string'}) ||
                         !validateResponse(res.devices[i].preKey, {publicKey: 'string'})) {
                        throw new Error("Invalid response");
                    }
                    res.devices[i].signedPreKey.publicKey = StringView.base64ToBytes(res.devices[i].signedPreKey.publicKey);
                    res.devices[i].signedPreKey.signature = StringView.base64ToBytes(res.devices[i].signedPreKey.signature);
                    res.devices[i].preKey.publicKey = StringView.base64ToBytes(res.devices[i].preKey.publicKey);
                }
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
                var match = response.location.match(this.attachment_id_regex);
                if (!match) {
                    throw new Error('Received invalid attachment url');
                }
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
                // Extract the id as a string from the location url
                // (workaround for ids too large for Javascript numbers)
                var match = response.location.match(this.attachment_id_regex);
                if (!match) {
                    throw new Error('Received invalid attachment url');
                }
                return ajax(response.location, {
                    type        : "PUT",
                    contentType : "application/octet-stream",
                    data        : encryptedBin,
                    processData : false,
                }).then(function() {
                    return match[1];
                }.bind(this));
            }.bind(this));
        },
        getMessageSocket: function() {
            return new WebSocket(
                this.url.replace('https://', 'wss://')
                    .replace('http://', 'ws://')
                    + '/v1/websocket/?login=' + encodeURIComponent(this.username)
                    + '&password=' + encodeURIComponent(this.password)
            );
        },
        getProvisioningSocket: function () {
            return new WebSocket(
                this.url.replace('https://', 'wss://')
                    .replace('http://', 'ws://')
                    + '/v1/websocket/provisioning/'
            );
        }
    };

    return TextSecureServer;
})();
