/* global Whisper */

describe('ScrollDownButtonView', () => {
  it('renders ', () => {
    const view = new Whisper.ScrollDownButtonView();
    view.render();
    assert.match(
      view.$el.html(),
      /<div class="session-icon-button huge" role="button"><svg /
    );
  });
});
