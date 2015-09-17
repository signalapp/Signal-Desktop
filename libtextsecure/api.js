/*
 * vim: ts=4:sw=4:expandtab
 */

TextSecureServer = function () {
    'use strict';

    var self = {};

    /************************************************
     *** Utilities to communicate with the server ***
     ************************************************/
    // Staging server
    var URL_BASE    = "https://textsecure-service-staging.whispersystems.org";
    self.relay      = "textsecure-service-staging.whispersystems.org";
    var ATTACHMENT_HOST = "whispersystems-textsecure-attachments-staging.s3.amazonaws.com";

    // This is the real server
    //var URL_BASE  = "https://textsecure-service.whispersystems.org";

    var URL_CALLS = {};
    URL_CALLS.accounts   = "/v1/accounts";
    URL_CALLS.devices    = "/v1/devices";
    URL_CALLS.keys       = "/v2/keys";
    URL_CALLS.push       = "/v1/websocket";
    URL_CALLS.temp_push  = "/v1/websocket/provisioning";
    URL_CALLS.messages   = "/v1/messages";
    URL_CALLS.attachment = "/v1/attachments";

    /**
        * REQUIRED PARAMS:
        *   call:               URL_CALLS entry
        *   httpType:           POST/GET/PUT/etc
        * OPTIONAL PARAMS:
        *   success_callback:   function(response object) called on success
        *   error_callback:     function(http status code = -1 or != 200) called on failure
        *   urlParameters:      crap appended to the url (probably including a leading /)
        *   user:               user name to be sent in a basic auth header
        *   password:           password to be sent in a basic auth header
        *   do_auth:            alternative to user/password where user/password are figured out automagically
        *   jsonData:           JSON data sent in the request body
        */
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
                    console.log('Success', xhr.status);
                    resolve(result, xhr.status);
                } else {
                    console.log('Error', xhr.status);
                    reject(HTTPError(xhr.status, result, error.stack));
                }
            };
            xhr.onerror = function() {
                console.log('Error', xhr.status);
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

    var doAjax = function (param) {
        if (param.urlParameters === undefined) {
            param.urlParameters = "";
        }

        if (param.do_auth) {
            param.user      = textsecure.storage.user.getNumber() + "." + textsecure.storage.user.getDeviceId();
            param.password  = textsecure.storage.get("password");
        }

        return ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
                type        : param.httpType,
                data        : param.jsonData && textsecure.utils.jsonThing(param.jsonData),
                contentType : 'application/json; charset=utf-8',
                dataType    : 'json',
                user        : param.user,
                password    : param.password
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
    };

    function requestVerificationCode(number, transport) {
        return doAjax({
            call                : 'accounts',
            httpType            : 'GET',
            urlParameters       : '/' + transport + '/code/' + number,
        });
    };
    self.requestVerificationSMS = function(number) {
        return requestVerificationCode(number, 'sms');
    };
    self.requestVerificationVoice = function(number) {
        return requestVerificationCode(number, 'voice');
    };

    self.getDevices = function(number) {
        return doAjax({
            call     : 'devices',
            httpType : 'GET',
            do_auth  : true
        });
    };

    self.confirmCode = function(number, code, password,
                                signaling_key, registrationId, deviceName) {
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
            return doAjax({
                call                : call,
                httpType            : 'PUT',
                urlParameters       : urlPrefix + code,
                user                : number,
                password            : password,
                jsonData            : jsonData
            });
    };

    self.registerKeys = function(genKeys) {
        var keys = {};
        keys.identityKey = btoa(getString(genKeys.identityKey));
        keys.signedPreKey = {keyId: genKeys.signedPreKey.keyId, publicKey: btoa(getString(genKeys.signedPreKey.publicKey)),
                            signature: btoa(getString(genKeys.signedPreKey.signature))};

        keys.preKeys = [];
        var j = 0;
        for (var i in genKeys.preKeys)
            keys.preKeys[j++] = {keyId: genKeys.preKeys[i].keyId, publicKey: btoa(getString(genKeys.preKeys[i].publicKey))};

        //TODO: This is just to make the server happy (v2 clients should choke on publicKey),
        // it needs removed before release
        keys.lastResortKey = {keyId: 0x7fffFFFF, publicKey: btoa("42")};

        return doAjax({
            call                : 'keys',
            httpType            : 'PUT',
            do_auth             : true,
            jsonData            : keys,
        });
    };

    self.getMyKeys = function(number, deviceId) {
        return doAjax({
            call                : 'keys',
            httpType            : 'GET',
            do_auth             : true,
        }).then(function(res) {
            return parseInt(res.count);
        });
    };

    self.getKeysForNumber = function(number, deviceId) {
        if (deviceId === undefined)
            deviceId = "*";

        return doAjax({
            call                : 'keys',
            httpType            : 'GET',
            do_auth             : true,
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
    };

    self.sendMessages = function(destination, messageArray, legacy) {
        //TODO: Do this conversion somewhere else?
        for (var i = 0; i < messageArray.length; i++) {
            messageArray[i].content = btoa(messageArray[i].content);
            if (legacy) {
                messageArray[i].body = messageArray[i].content;
                delete messageArray[i].content;
            }
        }
        var jsonData = { messages: messageArray };
        if (messageArray[0].relay !== undefined)
            jsonData.relay = messageArray[0].relay;
        jsonData.timestamp = messageArray[0].timestamp;

        return doAjax({
            call                : 'messages',
            httpType            : 'PUT',
            urlParameters       : '/' + destination,
            do_auth             : true,
            jsonData            : jsonData,
        });
    };

    self.getAttachment = function(id) {
        return doAjax({
            call                : 'attachment',
            httpType            : 'GET',
            urlParameters       : '/' + id,
            do_auth             : true,
        }).then(function(response) {
            return ajax(response.location, {
                type        : "GET",
                responseType: "arraybuffer",
                contentType : "application/octet-stream"
            });
        });
    };

    var id_regex = RegExp( "^https:\/\/" + ATTACHMENT_HOST + "\/(\\d+)\?");
    self.putAttachment = function(encryptedBin) {
        return doAjax({
            call     : 'attachment',
            httpType : 'GET',
            do_auth  : true,
        }).then(function(response) {
            return ajax(response.location, {
                type        : "PUT",
                contentType : "application/octet-stream",
                data        : encryptedBin,
                processData : false,
            }).then(function() {
                // Parse the id as a string from the location url
                // (workaround for ids too large for Javascript numbers)
                return response.location.match(id_regex)[1];
            });
        });
    };

    self.getMessageWebsocket = function(url) {
        var user = textsecure.storage.user.getNumber() + "." + textsecure.storage.user.getDeviceId();
        var password = textsecure.storage.get("password");
        var params = 'login=%2B' + encodeURIComponent(user.substring(1)) + '&password=' + encodeURIComponent(password);
        var url = url + URL_CALLS['push'] + '/?' + params;
        return TextSecureWebSocket(url, {reconnectTimeout: false});
    }

    self.getTempWebsocket = function() {
        var url = URL_BASE.replace(/^http/g, 'ws') + URL_CALLS['temp_push'] + '/?';
        return TextSecureWebSocket(url, {reconnectTimeout: false});
    }

    return self;
}();
