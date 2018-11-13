/* global Backbone, Whisper */

describe('ListView', () => {
  let collection;

  beforeEach(() => {
    collection = new Backbone.Collection();
  });

  it('should add children to the list element as they are added to the collection', () => {
    const view = new Whisper.ListView({ collection });
    collection.add('hello');
    assert.equal(view.$el.children().length, 1);
    collection.add('world');
    assert.equal(view.$el.children().length, 2);
  });

  it('should add all the children to the list element on reset', () => {
    const view = new Whisper.ListView({ collection });
    collection.reset(['goodbye', 'world']);
    assert.equal(view.$el.children().length, 2);
  });
});
