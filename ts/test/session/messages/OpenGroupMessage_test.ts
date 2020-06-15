import { expect } from 'chai';

import {
  AttachmentPointer,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import * as MIME from '../../../../ts/types/MIME';
import { OpenGroup } from '../../../session/types/OpenGroup'

describe('OpenGroupMessage', () => {
  const group = new OpenGroup({
    server: 'chat.example.server',
    channel: 1,
    conversationId: '0',
  });

  it('can create empty message with just a timestamp and group', () => {
    const message = new OpenGroupMessage({
      timestamp: Date.now(),
      group,
    });
    expect(message?.timestamp).to.be.approximately(Date.now(), 10);
    expect(message?.group).to.deep.equal(group);
    expect(message?.body).to.be.equal(undefined, 'body should be undefined');
    expect(message?.quote).to.be.equal(undefined, 'quote should be undefined');
    expect(message?.attachments).to.have.lengthOf(0);
    expect(message?.preview).to.have.lengthOf(0);
  });

  it('can create message with a body', () => {
    const message = new OpenGroupMessage({
      timestamp: Date.now(),
      group,
      body: 'body',
    });
    expect(message).to.have.deep.property('body', 'body');
  });

  it('can create message with a quote', () => {
    const attachment = {
      contentType: MIME.IMAGE_JPEG,
      fileName: 'fileName',
      isVoiceMessage: false,
    };
    const quote = {
      id: 0,
      author: 'me',
      text: 'hi',
      attachments: [attachment],
    };
    const message = new OpenGroupMessage({
      timestamp: Date.now(),
      group,
      quote,
    });
    expect(message?.quote).to.deep.equal(quote);
  });

  it('can create message with an attachment', () => {
    const attachment: AttachmentPointer = {
      id: 0,
      contentType: 'type',
      key: new Uint8Array(1),
      size: 10,
      thumbnail: new Uint8Array(2),
      digest: new Uint8Array(3),
      filename: 'filename',
      flags: 0,
      width: 10,
      height: 20,
      caption: 'caption',
      url: 'url',
    };
    const message = new OpenGroupMessage({
      timestamp: Date.now(),
      group,
      attachments: [attachment],
    });
    expect(message?.attachments).to.have.lengthOf(1);
    expect(message?.attachments[0]).to.deep.equal(attachment);
  });

  it('has an identifier', () => {
    const message = new OpenGroupMessage({
      timestamp: Date.now(),
      group,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
