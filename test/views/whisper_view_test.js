/* global Whisper */

describe('Whisper.View', () => {
  it('renders a template with render_attributes', () => {
    const ViewClass = Whisper.View.extend({
      template: '<div>{{ variable }}</div>',
      render_attributes: {
        variable: 'value',
      },
    });

    const view = new ViewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
  it('renders a template with no render_attributes', () => {
    const ViewClass = Whisper.View.extend({
      template: '<div>static text</div>',
    });

    const view = new ViewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>static text</div>');
  });
  it('renders a template function with render_attributes function', () => {
    const ViewClass = Whisper.View.extend({
      template() {
        return '<div>{{ variable }}</div>';
      },
      render_attributes() {
        return { variable: 'value' };
      },
    });
    const view = new ViewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
});
