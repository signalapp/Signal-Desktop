/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    // register some chrome listeners
    if (chrome.notifications) {
        chrome.notifications.onClicked.addListener(function() {
            chrome.notifications.clear('signal');
            Whisper.Notifications.onclick();
        });
        chrome.notifications.onButtonClicked.addListener(function() {
            chrome.notifications.clear('signal');
            Whisper.Notifications.clear();
            getInboxCollection().each(function(model) {
                model.markRead();
            });
        });
        chrome.notifications.onClosed.addListener(function(id, byUser) {
            if (byUser) {
                Whisper.Notifications.clear();
            }
        });
    }
    if (chrome && chrome.alarms) {
        chrome.alarms.onAlarm.addListener(function() {
            // nothing to do.
        });
        chrome.alarms.create('awake', {periodInMinutes: 1});
    }

    // Close and reopen existing windows
    var open = false;
    chrome.app.window.getAll().forEach(function(appWindow) {
        open = true;
        appWindow.close();
    });

    // start a background worker for ecc
    textsecure.protocol_wrapper.startWorker();

    // load the initial set of conversations into memory
    ConversationController.updateInbox();

    extension.onLaunched(function() {
        storage.onready(function() {
            if (textsecure.registration.isDone()) {
                openInbox();
            } else {
                extension.install();
            }
        });
    });

    var SERVER_URL = 'https://textsecure-service-staging.whispersystems.org';
    var messageReceiver;
    window.getSocketStatus = function() {
        if (messageReceiver) {
            return messageReceiver.getStatus();
        } else {
            return -1;
        }
    };
    storage.fetch();
    storage.onready(function() {
        setUnreadCount(storage.get("unreadCount", 0));

        if (textsecure.registration.isDone()) {
            init();
        }

        extension.on('registration_done', function() {
            init(true);
        });

        if (open) {
            openInbox();
        }
    });

    function init(firstRun) {
        window.removeEventListener('online', init);
        if (!textsecure.registration.isDone()) { return; }

        if (messageReceiver) { messageReceiver.close(); }

        var USERNAME = storage.get('number_id');
        var PASSWORD = storage.get('password');
        var mySignalingKey = storage.get('signaling_key');

        // initialize the socket and start listening for messages
        messageReceiver = new textsecure.MessageReceiver(SERVER_URL, USERNAME, PASSWORD, mySignalingKey);
        messageReceiver.addEventListener('message', onMessageReceived);
        messageReceiver.addEventListener('receipt', onDeliveryReceipt);
        messageReceiver.addEventListener('contact', onContactReceived);
        messageReceiver.addEventListener('group', onGroupReceived);
        messageReceiver.addEventListener('sent', onSentMessage);
        messageReceiver.addEventListener('error', onError);

        messageReceiver.addEventListener('contactsync', onContactSyncComplete);

        if (firstRun === true && textsecure.storage.user.getDeviceId() != '1') {
            textsecure.messaging.sendRequestContactSyncMessage().then(function() {
                textsecure.messaging.sendRequestGroupSyncMessage();
            });
        }
    }

    function onContactSyncComplete() {
        window.dispatchEvent(new Event('textsecure:contactsync'));
    }

    function onContactReceived(ev) {
        var contactDetails = ev.contactDetails;
        ConversationController.create({
            name: contactDetails.name,
            id: contactDetails.number,
            avatar: contactDetails.avatar,
            type: 'private'
        }).save();
    }

    function onGroupReceived(ev) {
        var groupDetails = ev.groupDetails;
        ConversationController.create({
            id: groupDetails.id,
            name: groupDetails.name,
            members: groupDetails.members,
            avatar: groupDetails.avatar,
            type: 'group',
        }).save();
    }

    function onMessageReceived(ev) {
        var data = ev.data;
        var message = initIncomingMessage(data.source, data.timestamp);
        message.handleDataMessage(data.message);
    }

    function onSentMessage(ev) {
        var now = new Date().getTime();
        var data = ev.data;

        var message = new Whisper.Message({
            source         : textsecure.storage.user.getNumber(),
            sent_at        : data.timestamp,
            received_at    : now,
            conversationId : data.destination,
            type           : 'outgoing',
            sent           : true
        });

        message.handleDataMessage(data.message);
    }

    function initIncomingMessage(source, timestamp) {
        var now = new Date().getTime();

        var message = new Whisper.Message({
            source         : source,
            sent_at        : timestamp,
            received_at    : now,
            conversationId : source,
            type           : 'incoming'
        });

        var newUnreadCount = storage.get("unreadCount", 0) + 1;
        storage.put("unreadCount", newUnreadCount);
        extension.navigator.setBadgeText(newUnreadCount);

        return message;
    }

    function onError(ev) {
        var e = ev.error;
        console.log(e);
        console.log(e.stack);

        if (e.name === 'HTTPError' && (e.code == 401 || e.code == 403)) {
            extension.install();
            return;
        }

        if (e.name === 'HTTPError' && e.code == -1) {
            // Failed to connect to server
            if (navigator.onLine) {
                console.log('retrying in 1 minute');
                setTimeout(init, 60000);
            } else {
                console.log('offline');
                messageReceiver.close();
                window.addEventListener('online', init);
            }
            return;
        }

        if (ev.proto) {
            var envelope = ev.proto;
            var message = initIncomingMessage(envelope.source, envelope.timestamp.toNumber());
            message.saveErrors(e).then(function() {
                ConversationController.findOrCreatePrivateById(message.get('conversationId')).then(function(conversation) {
                    conversation.save({
                        active_at: Date.now(),
                        unreadCount: conversation.get('unreadCount') + 1
                    });
                    notifyConversation(message);
                });
            });
        }

        throw e;
    }

    // lazy hack
    window.receipts = new Backbone.Collection();

    function updateConversation(conversationId) {
        var conversation = ConversationController.get(conversationId);
        if (conversation) {
            conversation.trigger('newmessages');
        }
    }

    function onDeliveryReceipt(ev) {
        var pushMessage = ev.proto;
        var timestamp = pushMessage.timestamp.toNumber();
        var messages  = new Whisper.MessageCollection();
        var groups    = new Whisper.ConversationCollection();
        console.log('delivery receipt', pushMessage.source, timestamp);
        messages.fetchSentAt(timestamp).then(function() {
            groups.fetchGroups(pushMessage.source).then(function() {
                for (var i in messages.where({type: 'outgoing'})) {
                    var message = messages.at(i);
                    var deliveries     = message.get('delivered') || 0;
                    var conversationId = message.get('conversationId');
                    if (conversationId === pushMessage.source || groups.get(conversationId)) {
                        message.save({delivered: deliveries + 1}).then(
                            // notify frontend listeners
                            updateConversation.bind(null, conversationId)
                        );
                        return;
                        // TODO: consider keeping a list of numbers we've
                        // successfully delivered to?
                    }
                }
                // if we get here, we didn't find a matching message.
                // keep the receipt in memory in case it shows up later
                // as a sync message.
                receipts.add({ timestamp: timestamp, source: pushMessage.source });
                return;
            });
        }).fail(function() {
            console.log('got delivery receipt for unknown message', pushMessage.source, timestamp);
        });
    }
})();
