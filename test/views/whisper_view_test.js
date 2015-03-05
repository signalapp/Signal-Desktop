describe('Whisper.View', function() {
  it('renders a template with attributes', function() {
    var viewClass = Whisper.View.extend({
      template: '<div>{{ variable }}</div>',
      attributes: {
        variable: 'value'
      }
    });

    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
  it('renders a template with no attributes', function() {
    var viewClass = Whisper.View.extend({
      template: '<div>static text</div>'
    });

    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>static text</div>');
  });
  it('renders a template function with attributes function', function() {
    var viewClass = Whisper.View.extend({
      template: function() { return '<div>{{ variable }}</div>'; },
      attributes: function() {
        return { variable: 'value' };
      }
    });
    var view = new viewClass();
    view.render();
    assert.strictEqual(view.$el.html(), '<div>value</div>');
  });
});
