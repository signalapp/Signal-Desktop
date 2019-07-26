/* global Whisper */

describe('InboxView', () => {
  const inboxView = new Whisper.InboxView({
    model: {},
    window,
    initialLoadComplete: () => {},
  }).render();

  describe('switching conversations with key events', () => {
    let openConversationCalls;
    const conversations = [
      new Whisper.Conversation({
        name: '1',
        id: '+1',
      }),
      new Whisper.Conversation({
        name: '2',
        id: '+2',
      }),
      new Whisper.Conversation({
        name: '3',
        id: '+3',
      }),
    ];

    beforeEach(() => {
      const collection = window.getInboxCollection();
      collection.reset([]);

      collection.add(conversations[0]);
      collection.add(conversations[1]);
      collection.add(conversations[2]);

      openConversationCalls = [];
      inboxView.openConversation = () => {
        openConversationCalls.push(arguments);
      };
    });

    it('should do nothing if the alt or ctrl keys are not pressed', () => {
      const event = {
        keyCode: 40,
      };
      inboxView.conversation_stack.stack = [conversations[1]];
      inboxView.switchConversation(event);

      assert(openConversationCalls.length === 0);
    });

    describe('with the ctrl key down', () => {
      const event = {
        ctrlKey: true,
      };

      testKeyDownEvents(event);
    });

    describe('with the alt key down', () => {
      const event = {
        altKey: true,
      };

      testKeyDownEvents(event);
    });

    function testKeyDownEvents(event) {
      const e = event;
      describe('and the down key is pressed', () => {
        before(() => {
          e.keyCode = 40;
        });

        it('should select the first conversation if none were selected', () => {
          inboxView.conversation_stack.stack = [];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 1);
          assert.deepEqual(openConversationCalls[0][1], conversations[0]);
        });

        it('should select the next conversation down when there is one', () => {
          inboxView.conversation_stack.stack = [conversations[1]];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 1);
          assert.deepEqual(openConversationCalls[0][1], conversations[2]);
        });

        it('should do nothing when there are no more conversations', () => {
          inboxView.conversation_stack.stack = [conversations[2]];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 0);
        });
      });

      describe('and the up key is pressed', () => {
        before(() => {
          e.keyCode = 38;
        });

        it('should select the first conversation if none were selected', () => {
          inboxView.conversation_stack.stack = [];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 1);
          assert.deepEqual(openConversationCalls[0][1], conversations[0]);
        });

        it('should select the next conversation up when there is one', () => {
          inboxView.conversation_stack.stack = [conversations[1]];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 1);
          assert.deepEqual(openConversationCalls[0][1], conversations[0]);
        });

        it('should do nothing when there are no more conversations', () => {
          inboxView.conversation_stack.stack = [conversations[0]];
          inboxView.switchConversation(e);

          assert(openConversationCalls.length === 0);
        });
      });
    }
  });
});
