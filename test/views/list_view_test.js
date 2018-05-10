describe('ListView', function() {
  var collection;

  beforeEach(function() {
    collection = new Backbone.Collection();
  });

  it('should add children to the list element as they are added to the collection', function() {
    var view = new Whisper.ListView({ collection: collection });
    collection.add('hello');
    assert.equal(view.$el.children().length, 1);
    collection.add('world');
    assert.equal(view.$el.children().length, 2);
  });

  it('should add all the children to the list element on reset', function() {
    var view = new Whisper.ListView({ collection: collection });
    collection.reset(['goodbye', 'world']);
    assert.equal(view.$el.children().length, 2);
  });
});
