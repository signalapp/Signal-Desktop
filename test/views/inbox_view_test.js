describe('InboxView', function() {
    var inboxView = new Whisper.InboxView({
        model: {},
        window: window,
        initialLoadComplete: function() {}
    }).render();

    var conversation = new Whisper.Conversation({ id: '1234', type: 'private'});

    describe('switching conversations with key events', function() {
        var openConversationCalls;
        var conversations = [new Whisper.Conversation({
            name: '1',
            id: '+1',
        }), new Whisper.Conversation({
            name: '2',
            id: '+2',
        }),
        new Whisper.Conversation({
            name: '3',
            id: '+3',
        })];

        beforeEach(function() {
            var collection = window.getInboxCollection();
            collection.reset([]);

            collection.add(conversations[0]);
            collection.add(conversations[1]);
            collection.add(conversations[2]);

            openConversationCalls = [];
            inboxView.openConversation = function() {
                openConversationCalls.push(arguments);
            };
        });

        it('should do nothing if the alt or ctrl keys are not pressed', function() {
            var event = {
                keyCode: 40
            };
            inboxView.conversation_stack.stack = [conversations[1]];
            inboxView.switchConversation(event);

            assert(openConversationCalls.length === 0);
        });

        describe('with the ctrl key down', function() {
            var event = {
                ctrlKey: true
            };

            testKeyDownEvents(event);
        });

        describe('with the alt key down', function() {
            var event = {
                altKey: true
            };

            testKeyDownEvents(event);
        });

        function testKeyDownEvents(event) {
            describe('and the down key is pressed', function() {
                before(function() {
                    event.keyCode = 40;
                });

                it ('should select the first conversation if none were selected', function() {
                    inboxView.conversation_stack.stack = [];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 1);
                    assert.deepEqual(openConversationCalls[0][1], conversations[0]);
                });

                it ('should select the next conversation down when there is one', function() {
                    inboxView.conversation_stack.stack = [conversations[1]];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 1);
                    assert.deepEqual(openConversationCalls[0][1], conversations[2]);
                });

                it ('should do nothing when there are no more conversations', function() {
                    inboxView.conversation_stack.stack = [conversations[2]];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 0);
                });
            });

            describe('and the up key is pressed', function() {
                before(function() {
                    event.keyCode = 38;
                });

                it ('should select the first conversation if none were selected', function() {
                    inboxView.conversation_stack.stack = [];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 1);
                    assert.deepEqual(openConversationCalls[0][1], conversations[0]);
                });

                it ('should select the next conversation up when there is one', function() {
                    inboxView.conversation_stack.stack = [conversations[1]];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 1);
                    assert.deepEqual(openConversationCalls[0][1], conversations[0]);
                });

                it ('should do nothing when there are no more conversations', function() {
                    inboxView.conversation_stack.stack = [conversations[0]];
                    inboxView.switchConversation(event);

                    assert(openConversationCalls.length === 0);
                });
            });
        }
    });
});
