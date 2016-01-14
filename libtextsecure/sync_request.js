/*
 * vim: ts=4:sw=4:expandtab
 */


;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function SyncRequest(sender, receiver) {
        this.receiver = receiver;

        this.oncontact = this.onContactSyncComplete.bind(this);
        receiver.addEventListener('contactsync', this.oncontact);

        this.ongroup = this.onGroupSyncComplete.bind(this);
        receiver.addEventListener('groupsync', this.ongroup);

        sender.sendRequestContactSyncMessage().then(function() {
            sender.sendRequestGroupSyncMessage();
        });
        this.timeout = setTimout(this.onTimeout.bind(this), 60000);
    }

    SyncRequest.prototype = {
        constructor: SyncRequest,
        onContactSyncComplete: function() {
            this.contactSync = true;
            this.update();
        },
        onGroupSyncComplete: function() {
            this.groupSync = true;
            this.update();
        },
        update: function() {
            if (this.contactSync && this.groupSync) {
                this.dispatchEvent(new Event('success'));
                this.cleanup();
            }
        },
        onTimeout: function() {
            this.dispatchEvent(new Event('timeout'));
            this.cleanup();
        },
        cleanup: function() {
            clearTimeout(this.timeout);
            this.receiver.removeEventListener('contactsync', this.oncontact);
            this.receiver.removeEventListener('groupSync', this.ongroup);
            delete this.listeners;
        },

        /* Implements EventTarget */  /// TODO: Dedupe this same code in MessageReceiver
        dispatchEvent: function(ev) {
            if (!(ev instanceof Event)) {
                throw new Error('Expects an event');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[ev.type];
            if (typeof listeners === 'object') {
                for (var i=0; i < listeners.length; ++i) {
                    if (typeof listeners[i] === 'function') {
                        listeners[i].call(null, ev);
                    }
                }
            }
        },
        addEventListener: function(eventName, callback) {
            if (typeof eventName !== 'string') {
                throw new Error('First argument expects a string');
            }
            if (typeof callback !== 'function') {
                throw new Error('Second argument expects a function');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[eventName];
            if (typeof listeners !== 'object') {
                listeners = [];
            }
            listeners.push(callback);
            this.listeners[eventName] = listeners;
        },
        removeEventListener: function(eventName, callback) {
            if (typeof eventName !== 'string') {
                throw new Error('First argument expects a string');
            }
            if (typeof callback !== 'function') {
                throw new Error('Second argument expects a function');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[eventName];
            for (var i=0; i < listeners.length; ++ i) {
                if (listeners[i] === callback) {
                    listeners.splice(i, 1);
                    return;
                }
            }
            this.listeners[eventName] = listeners;
        }
    };

    textsecure.SyncRequest = function(sender, receiver) {
        var syncRequest = new SyncRequest(sender, receiver);
        this.addEventListener    = syncRequest.addEventListener.bind(syncRequest);
        this.removeEventListener = syncRequest.removeEventListener.bind(syncRequest);
    };

    textsecure.SyncRequest.prototype = {
        constructor: textsecure.SyncRequest
    };


}());
