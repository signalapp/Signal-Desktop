describe('ConversationSearchView', function() {
  describe('Searching for left groups', function() {
    let convo;

    before(() => {
      convo = new Whisper.ConversationCollection().add({
        id: '1-search-view',
        name: 'i left this group',
        members: [],
        type: 'group',
        left: true,
      });

      return window.Signal.Data.saveConversation(convo.attributes, {
        Conversation: Whisper.Conversation,
      });
    });
    describe('with no messages', function() {
      var input;
      var view;

      before(function(done) {
        input = $('<input>');
        view = new Whisper.ConversationSearchView({ input: input }).render();
        view.$input.val('left');
        view.filterContacts();
        view.typeahead_view.collection.on('reset', function() {
          done();
        });
      });
      it('should not surface left groups with no messages', function() {
        assert.isUndefined(
          view.typeahead_view.collection.get(convo.id),
          'got left group'
        );
      });
    });
    describe('with messages', function() {
      var input;
      var view;
      before(async function() {
        input = $('<input>');
        view = new Whisper.ConversationSearchView({ input: input }).render();
        convo.set({ id: '2-search-view', left: false });

        await window.Signal.Data.saveConversation(convo.attributes, {
          Conversation: Whisper.Conversation,
        });

        view.$input.val('left');
        view.filterContacts();

        return new Promise(resolve => {
          view.typeahead_view.collection.on('reset', resolve);
        });
      });
      it('should surface left groups with messages', function() {
        assert.isDefined(
          view.typeahead_view.collection.get(convo.id),
          'got left group'
        );
      });
    });
  });
});
