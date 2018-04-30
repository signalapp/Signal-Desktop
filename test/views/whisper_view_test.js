describe('Whisper.View', function() {
  it('renders a template with render_attributes', function() {
    var viewClass = Whisper.View.extend({
      template: '<div>{{ variable }}</div>',
      render_attributes: {
        variable: 'value',
      },
    });

    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
  it('renders a template with no render_attributes', function() {
    var viewClass = Whisper.View.extend({
      template: '<div>static text</div>',
    });

    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>static text</div>');
  });
  it('renders a template function with render_attributes function', function() {
    var viewClass = Whisper.View.extend({
      template: function() {
        return '<div>{{ variable }}</div>';
      },
      render_attributes: function() {
        return { variable: 'value' };
      },
    });
    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
});
