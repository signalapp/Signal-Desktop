describe('ConversationSearchView', function() {
  it('should match partial numbers', function() {
    var $el = $('<div><div class="new-contact contact hide"></div></div>');
    var view = new Whisper.ConversationSearchView({el: $el, input: $('<input>')}).render();
    var maybe_numbers = [
      "+1 415",
      "+1415",
      "+1415",
      "415",
      "(415)",
      " (415",
      "(415) 123 4567",
      "+1 (415) 123 4567",
      " +1 (415) 123 4567",
      "1 (415) 123 4567",
      "1 415-123-4567",
      "415-123-4567"
    ];
    maybe_numbers.forEach(function(n) {
      assert.ok(view.maybeNumber(n), n);
    });
  });

});
