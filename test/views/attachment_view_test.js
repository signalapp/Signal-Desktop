/* global assert: false */

/* global Whisper: false */

'use strict';

describe('AttachmentView', () => {
  describe('with arbitrary files', () => {
    it('should render a file view', () => {
      const attachment = {
        contentType: 'unused',
        size: 1232,
      };
      const view = new Whisper.AttachmentView({ model: attachment }).render();
      assert.match(view.el.innerHTML, /fileView/);
    });
    it('should display the filename if present', () => {
      const attachment = {
        fileName: 'foo.txt',
        contentType: 'unused',
        size: 1232,
      };
      const view = new Whisper.AttachmentView({ model: attachment }).render();
      assert.match(view.el.innerHTML, /foo.txt/);
    });
    it('should render a file size', () => {
      const attachment = {
        size: 1232,
        contentType: 'unused',
      };
      const view = new Whisper.AttachmentView({ model: attachment }).render();
      assert.match(view.el.innerHTML, /1.2 KB/);
    });
  });
  it('should render an image for images', () => {
    const now = new Date().getTime();
    const attachment = { contentType: 'image/png', data: 'grumpy cat' };
    const view = new Whisper.AttachmentView({
      model: attachment,
      timestamp: now,
    }).render();
    assert.equal(view.el.firstChild.tagName, 'IMG');
  });
});
