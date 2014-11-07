/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.NATIVE_CLIENT = window.textsecure.NATIVE_CLIENT || true;

    if (!textsecure.NATIVE_CLIENT) {
        window.textsecure.registerOnLoadFunction = window.textsecure.nativeclient.registerOnLoadFunction;
    }

    var naclMessageNextId = 0;
    var naclMessageIdCallbackMap = {};
    window.handleMessage = function(message) {
        naclMessageIdCallbackMap[message.data.call_id](message.data);
    }

    function postMessage(message) {
        return new Promise(function(resolve) {
            naclMessageIdCallbackMap[naclMessageNextId] = resolve;
            message.call_id = naclMessageNextId++;
            common.naclModule.postMessage(message);
        });
    };

    var onLoadCallbacks = [];
    var naclLoaded = false;
    window.moduleDidLoad = function() {
        common.hideModule();
        naclLoaded = true;
        for (var i = 0; i < onLoadCallbacks.length; i++) {
            try {
                onLoadCallbacks[i][1](onLoadCallbacks[i][0]());
            } catch (e) {
                onLoadCallbacks[i][2](e);
            }
        }
        onLoadCallbacks = [];
    }

    window.textsecure.nativeclient = {
        privToPub: function(priv) {
            return postMessage({command: "bytesToPriv", priv: priv}).then(function(message) {
                var priv = message.res.slice(0, 32);
                return postMessage({command: "privToPub", priv: priv}).then(function(message) {
                    return { pubKey: message.res.slice(0, 32), privKey: priv };
                });
            });
        },
        ECDHE: function(pub, priv) {
            return postMessage({command: "ECDHE", pub: pub, priv: priv}).then(function(message) {
                return message.res.slice(0, 32);
            });
        },
        Ed25519Sign: function(priv, msg) {
            return postMessage({command: "Ed25519Sign", priv: priv, msg: msg}).then(function(message) {
                return message.res;
            });
        },
        Ed25519Verify: function(pub, msg, sig) {
            return postMessage({command: "Ed25519Verify", pub: pub, msg: msg, sig: sig}).then(function(message) {
                if (!message.res)
                    throw new Error("Invalid signature");
            });
        },
        registerOnLoadFunction: function(func) {
            return new Promise(function(resolve, reject) {
                if (naclLoaded) {
                    return resolve(func());
                } else {
                    onLoadCallbacks[onLoadCallbacks.length] = [ func, resolve, reject ];
                }
            });
        }
    };

})();
