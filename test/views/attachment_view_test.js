describe('AttachmentView', function() {

  it('should render a data url for arbitrary content', function() {
    var attachment = { contentType: 'arbitrary/content' };
    var view = new Whisper.AttachmentView({model: attachment}).render();
    assert.equal(view.el.firstChild.tagName, "A");
  });

  it('should render an image for images', function() {
    var now = new Date().getTime();
    var attachment = { contentType: 'image/png', data: 'grumpy cat' };
    var view = new Whisper.AttachmentView({model: attachment, timestamp: now}).render();
    assert.equal(view.el.firstChild.tagName, "IMG");
  });

  it('shoud have correct filename format', function() {
    var epoch = new Date((new Date(0)).getTimezoneOffset() * 60 * 1000);
    var attachment = { contentType: 'image/png', data: 'grumpy cat' };
    var result = new Whisper.AttachmentView({
      model: attachment,
      timestamp: epoch
    }).suggestedName();

    var expected = '1970-01-01-000000';
    assert(result === 'signal-' + expected + '.png');
  });
});
