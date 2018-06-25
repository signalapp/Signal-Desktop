'use strict';

describe('Fixtures', function() {
  before(function(done) {
    // NetworkStatusView checks this method every five seconds while showing
    window.getSocketStatus = function() {
      return WebSocket.OPEN;
    };

    Whisper.Fixtures()
      .saveAll()
      .then(function() {
        done();
      });
  });

  it('renders', function(done) {
    ConversationController.reset();
    ConversationController.load()
      .then(function() {
        var view = new Whisper.InboxView({ window: window });
        view.onEmpty();
        view.$el.prependTo($('#render-light-theme'));

        var view = new Whisper.InboxView({ window: window });
        view.$el.removeClass('light-theme').addClass('dark-theme');
        view.onEmpty();
        view.$el.prependTo($('#render-dark-theme'));
      })
      .then(done, done);
  });
});
