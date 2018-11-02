/* global assert, storage, Whisper */

'use strict';

describe('AttachmentView', () => {
  let convo;

  before(async () => {
    await clearDatabase();

    convo = new Whisper.Conversation({ id: 'foo' });
    convo.messageCollection.add({
      conversationId: convo.id,
      body: 'hello world',
      type: 'outgoing',
      source: '+14158675309',
      received_at: Date.now(),
    });

    await storage.put('number_id', '+18088888888.1');
  });

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
