'use strict';

describe("Fixtures", function() {
  before(function(done) {
    Whisper.Fixtures.saveAll().then(done);
  });
  it('renders', function(done) {
    ConversationController.updateInbox().then(function() {
      var view = new Whisper.InboxView({appWindow: {contentWindow: window}});
      view.$el.prependTo($('#render-android'));

      var view = new Whisper.InboxView({appWindow: {contentWindow: window}});
      view.$el.removeClass('android').addClass('ios');
      view.$el.prependTo($('#render-ios'));
    }).then(done,done);
  });
});
