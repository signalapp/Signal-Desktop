/* vim: ts=4:sw=4
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

'use strict';

/*
*  Load this script in a Web Worker to generate new prekeys without
*  tying up the main thread.
*  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
*
*  Because workers don't have access to the window or localStorage, we
*  create our own version that proxies back to the caller for actual
*  storage.
*
*  Example usage:
*
    var myWorker = new Worker('/js/generate_keys.js');
    myWorker.onmessage = function(e) {
        switch(e.data.method) {
            case 'set':
                localStorage.setItem(e.data.key, e.data.value);
                break;
            case 'remove':
                localStorage.removeItem(e.data.key);
                break;
            case 'done':
                console.log(e.data.keys);
        }
    };
*/
var store = {};
var window = this;
importScripts('libtextsecure.js');
window.textsecure.storage.impl = {
    /*****************************
    *** Override Storage Routines ***
    *****************************/
    put: function(key, value) {
        if (value === undefined)
            throw new Error("Tried to store undefined");
        store[key] = value;
        postMessage({method: 'set', key: key, value: value});
    },

    get: function(key, defaultValue) {
        if (key in store) {
            return store[key];
        } else {
            return defaultValue;
        }
    },

    remove: function(key) {
        delete store[key];
        postMessage({method: 'remove', key: key});
    },
};
onmessage = function(e) {
    store = e.data;
    textsecure.protocol_wrapper.generateKeys().then(function(keys) {
        postMessage({method: 'done', keys: keys});
        close();
    });
}
