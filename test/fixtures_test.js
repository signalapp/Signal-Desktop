/* global $, textsecure, Whisper */

'use strict';

describe('Fixtures', () => {
  before(async () => {
    // NetworkStatusView checks this method every five seconds while showing

    await clearDatabase();
    await textsecure.storage.user.setNumberAndDeviceId(
      '05123456789abcdef05123456789abcdef05123456789abcdef05123456789abcd',
      2,
      'testDevice'
    );

    await window
      .getConversationController()
      .getOrCreateAndWait(textsecure.storage.user.getNumber(), 'private');
  });

  it('renders', async () => {
    await Whisper.Fixtures().saveAll();

    window.getConversationController().reset();
    await window.getConversationController().load();

    let view = new Whisper.InboxView({ window });
    view.$el.prependTo($('#render-light-theme'));

    view = new Whisper.InboxView({ window });
    view.$el.removeClass('light-theme').addClass('dark-theme');
    view.$el.prependTo($('#render-dark-theme'));
  });
});
