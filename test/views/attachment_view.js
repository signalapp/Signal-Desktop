describe('AttachmentView', function() {

  it('should display an error for an unsupported type', function() {
    var attachment = {
      contentType: 'html/text';
    }
    var view = new Whisper.AttachmentView({model: attachment}).render();
    assert.match(view.$el.text(), /Sorry, your attachment has a type, html, that is not currently supported./);
  });

});
