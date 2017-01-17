describe('AttachmentView', function() {

  it('should give a data url for arbitrary content', function() {
    var attachment = { contentType: 'arbitrary/content' };
    var view = new Whisper.AttachmentView({model: attachment}).render();
    assert.match(view.$el.find("a[href]").attr("href"), /http:\/\/localhost/);
  });

  it('should have proper properties', function() {
    var now = new Date().getTime();
    var attachment = { contentType: 'image/png', data: 'grumpy cat', timestamp: now };
    var view = new Whisper.AttachmentView({model: attachment});

    assert.match(view.contentType, /image/);
    assert.match(view.fileType, /png/);
    assert.equal(view.timestamp, now);
    assert.isTrue(view.blob instanceof Blob);
  });

  it('shoud have correct filename format', function() {
    var filename;

    // mock out filesystem access
    extension.windows.getViews = function () {
      return [window];
    };

    var window = {
      chrome: {
        fileSystem: {
          chooseEntry: function(data, cb) {
            // get the filename
            filename = data.suggestedName;
          }
        }
      }
    };

    var epoch = new Date(0).getTime();
    var attachment = { contentType: 'image/png', data: 'grumpy cat', timestamp: epoch};
    var view = new Whisper.AttachmentView({model: attachment}).saveFile();

    var expected = '1970-01-01-000000';
    assert(filename === 'signal-' + expected + '.png');
  });
});
