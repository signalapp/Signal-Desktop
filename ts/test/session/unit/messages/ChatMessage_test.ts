import { expect } from 'chai';

import { SignalService } from '../../../../protobuf';
import { TextEncoder } from 'util';
import { toNumber } from 'lodash';
import { Constants } from '../../../../session';
import {
  AttachmentPointer,
  Preview,
  Quote,
  VisibleMessage,
} from '../../../../session/messages/outgoing/visibleMessage/VisibleMessage';

describe('VisibleMessage', () => {
  it('can create empty message with just a timestamp', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded).to.have.not.property('dataMessage', null);
    expect(decoded).to.have.not.property('dataMessage', undefined);
  });

  it('can create message with a body', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      body: 'body',
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('body', 'body');
  });

  it('can create message with a expire timer', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      expireTimer: 3600,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('expireTimer', 3600);
  });

  it('can create message with a full loki profile', () => {
    const profileKey = new TextEncoder().encode('profileKey');

    const lokiProfile = {
      displayName: 'displayName',
      avatarPointer: 'avatarPointer',
      profileKey,
    };
    const message = new VisibleMessage({
      timestamp: Date.now(),
      lokiProfile: lokiProfile,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('profile');

    expect(decoded.dataMessage)
      .to.have.property('profile')
      .to.have.deep.property('displayName', 'displayName');
    expect(decoded.dataMessage)
      .to.have.property('profile')
      .to.have.deep.property('profilePicture', 'avatarPointer');
    expect(decoded.dataMessage).to.have.deep.property('profileKey', profileKey);
  });

  it('can create message with a quote without attachments', () => {
    let quote: Quote;

    quote = { id: 1234, author: 'author', text: 'text' };
    const message = new VisibleMessage({
      timestamp: Date.now(),
      quote,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const decodedID = toNumber(decoded.dataMessage?.quote?.id);
    expect(decodedID).to.be.equal(1234);
    expect(decoded.dataMessage?.quote).to.have.deep.property('author', 'author');
    expect(decoded.dataMessage?.quote).to.have.deep.property('text', 'text');
  });

  it('can create message with a preview', () => {
    let preview: Preview;

    preview = { url: 'url', title: 'title' };
    const previews = new Array<Preview>();
    previews.push(preview);

    const message = new VisibleMessage({
      timestamp: Date.now(),
      preview: previews,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage?.preview).to.have.lengthOf(1);
    expect(decoded.dataMessage)
      .to.have.nested.property('preview[0].url')
      .to.be.deep.equal('url');
    expect(decoded.dataMessage)
      .to.have.nested.property('preview[0].title')
      .to.be.deep.equal('title');
  });

  it('can create message with an AttachmentPointer', () => {
    let attachment: AttachmentPointer;

    attachment = { url: 'url', contentType: 'contentType', id: 1234 };
    const attachments = new Array<AttachmentPointer>();
    attachments.push(attachment);

    const message = new VisibleMessage({
      timestamp: Date.now(),
      attachments: attachments,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage?.attachments).to.have.lengthOf(1);
    const firstAttachment = decoded?.dataMessage?.attachments?.[0];
    const decodedID = toNumber(firstAttachment?.id);
    expect(decodedID).to.be.equal(1234);
    expect(firstAttachment?.contentType).to.be.deep.equal('contentType');
    expect(firstAttachment?.url).to.be.deep.equal('url');
  });

  it('correct ttl', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TTL_MAX);
  });

  it('has an identifier', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
