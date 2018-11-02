/* global $, ConversationController, textsecure, Whisper */

'use strict';

describe('Fixtures', () => {
  before(async () => {
    // NetworkStatusView checks this method every five seconds while showing
    window.getSocketStatus = () => WebSocket.OPEN;

    await clearDatabase();
    await textsecure.storage.user.setNumberAndDeviceId(
      '+17015552000',
      2,
      'testDevice'
    );

    await ConversationController.getOrCreateAndWait(
      textsecure.storage.user.getNumber(),
      'private'
    );
  });

  it('renders', async () => {
    await Whisper.Fixtures().saveAll();

    ConversationController.reset();
    await ConversationController.load();

    let view = new Whisper.InboxView({ window });
    view.onEmpty();
    view.$el.prependTo($('#render-light-theme'));

    view = new Whisper.InboxView({ window });
    view.$el.removeClass('light-theme').addClass('dark-theme');
    view.onEmpty();
    view.$el.prependTo($('#render-dark-theme'));
  });
});
