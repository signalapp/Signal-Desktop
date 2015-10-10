/*
 * vim: ts=4:sw=4:expandtab
 */

var TextSecureServer = (function() {
    'use strict';

    // Promise-based async xhr routine
    function ajax(url, options) {
        return new Promise(function (resolve, reject) {
            console.log(options.type, url);
            var error = new Error(); // just in case, save stack here.
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
                }
                if ( 0 <= xhr.status && xhr.status < 400) {
                    console.log(options.type, url, xhr.status, 'Success');
                    resolve(result, xhr.status);
                } else {
                    console.log(options.type, url, xhr.status, 'Error');
                    reject(HTTPError(xhr.status, result, error.stack));
                }
            };
            xhr.onerror = function() {
                console.log(options.type, url, xhr.status, 'Error');
                reject(HTTPError(xhr.status, null, error.stack));
            };
            xhr.send( options.data || null );
        });
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

    var attachment_id_regex = RegExp( "^https:\/\/.*\/(\\d+)\?");

    function TextSecureServer(url, username, password) {
        if (typeof url !== 'string') {
            throw new Error('Invalid server url');
        }
        this.url = url;
        this.username = username;
        this.password = password;
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
                    password    : this.password
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
                    message = "Number is not registered with TextSecure.";
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
            var call = deviceName ? 'devices' : 'accounts';
            var urlPrefix = deviceName ? '/' : '/code/';

            var jsonData = {
                signalingKey    : btoa(getString(signaling_key)),
                supportsSms     : false,
                fetchesMessages : true,
                registrationId  : registrationId,
            };
            if (deviceName) {
                jsonData.name = deviceName;
            }
            this.username = number;
            this.password = password;
            return this.ajax({
                call                : call,
                httpType            : 'PUT',
                urlParameters       : urlPrefix + code,
                jsonData            : jsonData
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

            //TODO: This is just to make the server happy (v2 clients should choke on publicKey),
            // it needs removed before release
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
            }).then(function(res) {
                return parseInt(res.count);
            });
        },
        getKeysForNumber: function(number, deviceId) {
            if (deviceId === undefined)
                deviceId = "*";

            return this.ajax({
                call                : 'keys',
                httpType            : 'GET',
                urlParameters       : "/" + number + "/" + deviceId,
            }).then(function(res) {
                var promises = [];
                res.identityKey = StringView.base64ToBytes(res.identityKey);
                for (var i = 0; i < res.devices.length; i++) {
                    res.devices[i].signedPreKey.publicKey = StringView.base64ToBytes(res.devices[i].signedPreKey.publicKey);
                    res.devices[i].signedPreKey.signature = StringView.base64ToBytes(res.devices[i].signedPreKey.signature);
                    res.devices[i].preKey.publicKey = StringView.base64ToBytes(res.devices[i].preKey.publicKey);
                    //TODO: Is this still needed?
                    //if (res.devices[i].keyId === undefined)
                    //  res.devices[i].keyId = 0;
                }
                return res;
            });
        },
        sendMessages: function(destination, messageArray) {
            var jsonData = { messages: messageArray };
            jsonData.timestamp = messageArray[0].timestamp;

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
            }).then(function(response) {
                return ajax(response.location, {
                    type        : "GET",
                    responseType: "arraybuffer",
                    contentType : "application/octet-stream"
                });
            });
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
                    // Parse the id as a string from the location url
                    // (workaround for ids too large for Javascript numbers)
                    return response.location.match(attachment_id_regex)[1];
                });
            });
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
