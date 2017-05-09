describe('AttachmentView', function() {

  describe('with arbitrary files', function() {
      it('should render a file view', function() {
        var attachment = {
          contentType: 'unused',
          size: 1232
        };
        var view = new Whisper.AttachmentView({model: attachment}).render();
        assert.match(view.el.innerHTML, /fileView/);
      });
      it('should display the filename if present', function() {
        var attachment = {
          fileName: 'foo.txt',
          contentType: 'unused',
          size: 1232,
        };
        var view = new Whisper.AttachmentView({model: attachment}).render();
        assert.match(view.el.innerHTML, /foo.txt/);
      });
      it('should render a file size', function() {
        var attachment = {
          size: 1232,
          contentType: 'unused'
        };
        var view = new Whisper.AttachmentView({model: attachment}).render();
        assert.match(view.el.innerHTML, /1.2 KB/);
      });
  });
  it('should render an image for images', function() {
    var now = new Date().getTime();
    var attachment = { contentType: 'image/png', data: 'grumpy cat' };
    var view = new Whisper.AttachmentView({model: attachment, timestamp: now}).render();
    assert.equal(view.el.firstChild.tagName, "IMG");
  });

  it('should display a filename', function() {
    var epoch = new Date((new Date(0)).getTimezoneOffset() * 60 * 1000);
    var attachment = { contentType: 'image/png', data: 'grumpy cat' };
    var result = new Whisper.AttachmentView({
      model: attachment,
      timestamp: epoch
    }).suggestedName();

    var expected = '1970-01-01-000000';
    assert(result === 'signal-' + expected + '.png');
  });
  it('should auto-generate a filename', function() {
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
