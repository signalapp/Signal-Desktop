'use strict';

describe('Fixtures', function() {
  before(function() {
    // NetworkStatusView checks this method every five seconds while showing
    window.getSocketStatus = function() {
      return WebSocket.OPEN;
    };
  });

  it('renders', async () => {
    await Whisper.Fixtures().saveAll();

    ConversationController.reset();
    await ConversationController.load();

    var view = new Whisper.InboxView({ window: window });
    view.onEmpty();
    view.$el.prependTo($('#render-light-theme'));

    var view = new Whisper.InboxView({ window: window });
    view.$el.removeClass('light-theme').addClass('dark-theme');
    view.onEmpty();
    view.$el.prependTo($('#render-dark-theme'));
  });
});
