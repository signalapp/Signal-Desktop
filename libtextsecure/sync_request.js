/*
 * vim: ts=4:sw=4:expandtab
 */


;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function SyncRequest(sender, receiver) {
        if (!(sender instanceof textsecure.MessageSender) || !(receiver instanceof textsecure.MessageReceiver)) {
            throw new Error('Tried to construct a SyncRequest without MessageSender and MessageReceiver');
        }
        this.receiver = receiver;

        this.oncontact = this.onContactSyncComplete.bind(this);
        receiver.addEventListener('contactsync', this.oncontact);

        this.ongroup = this.onGroupSyncComplete.bind(this);
        receiver.addEventListener('groupsync', this.ongroup);

        console.log('SyncRequest created. Sending contact sync message...');
        sender.sendRequestContactSyncMessage().then(function() {
            console.log('SyncRequest now sending group sync messsage...');
            return sender.sendRequestGroupSyncMessage();
        }).catch(function(error) {
            console.log(
                'SyncRequest error:',
                error && error.stack ? error.stack : error
            );
        });
        this.timeout = setTimeout(this.onTimeout.bind(this), 60000);
    }

    SyncRequest.prototype = new textsecure.EventTarget();
    SyncRequest.prototype.extend({
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
            if (this.contactSync || this.groupSync) {
                this.dispatchEvent(new Event('success'));
            } else {
                this.dispatchEvent(new Event('timeout'));
            }
            this.cleanup();
        },
        cleanup: function() {
            clearTimeout(this.timeout);
            this.receiver.removeEventListener('contactsync', this.oncontact);
            this.receiver.removeEventListener('groupSync', this.ongroup);
            delete this.listeners;
        }
    });

    textsecure.SyncRequest = function(sender, receiver) {
        var syncRequest = new SyncRequest(sender, receiver);
        this.addEventListener    = syncRequest.addEventListener.bind(syncRequest);
        this.removeEventListener = syncRequest.removeEventListener.bind(syncRequest);
    };

    textsecure.SyncRequest.prototype = {
        constructor: textsecure.SyncRequest
    };


}());
