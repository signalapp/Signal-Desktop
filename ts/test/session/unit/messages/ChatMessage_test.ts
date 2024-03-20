import { expect } from 'chai';
import { TextEncoder } from 'util';

import { toNumber } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../../../../session/messages/outgoing/visibleMessage/VisibleMessage';

const sharedNoExpire = {
  expirationType: null,
  expireTimer: null,
};

describe('VisibleMessage', () => {
  it('can create empty message with just a timestamp', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      ...sharedNoExpire,
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
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('body', 'body');
  });

  it('can create a disappear after read message', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      ...sharedNoExpire,
      expirationType: 'deleteAfterRead',
      expireTimer: 300,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded, 'should have an expirationType of deleteAfterRead').to.have.deep.property(
      'expirationType',
      SignalService.Content.ExpirationType.DELETE_AFTER_READ
    );
    expect(decoded, 'should have an expirationTimer of 5 minutes').to.have.deep.property(
      'expirationTimer',
      300
    );
  });

  it('can create a disappear after send message', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      ...sharedNoExpire,
      expirationType: 'deleteAfterSend',
      expireTimer: 60,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded, 'should have an expirationType of deleteAfterSend').to.have.deep.property(
      'expirationType',
      SignalService.Content.ExpirationType.DELETE_AFTER_SEND
    );
    expect(decoded, 'should have an expirationTimer of 1 minute').to.have.deep.property(
      'expirationTimer',
      60
    );
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
      lokiProfile,
      ...sharedNoExpire,
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
    const quote: Quote = { id: 1234, author: 'author', text: 'text' };
    const message = new VisibleMessage({
      timestamp: Date.now(),
      quote,
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const decodedID = toNumber(decoded.dataMessage?.quote?.id);
    expect(decodedID).to.be.equal(1234);
    expect(decoded.dataMessage?.quote).to.have.deep.property('author', 'author');
    expect(decoded.dataMessage?.quote).to.have.deep.property('text', 'text');
  });

  it('can create message with a preview', () => {
    const preview: PreviewWithAttachmentUrl = { url: 'url', title: 'title', id: 1 };
    const previews = new Array<PreviewWithAttachmentUrl>();
    previews.push(preview);

    const message = new VisibleMessage({
      timestamp: Date.now(),
      preview: previews,
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage?.preview).to.have.lengthOf(1);
    expect(decoded.dataMessage).to.have.nested.property('preview[0].url').to.be.deep.equal('url');
    expect(decoded.dataMessage)
      .to.have.nested.property('preview[0].title')
      .to.be.deep.equal('title');
  });

  it('can create message with an AttachmentPointer', () => {
    const attachment: AttachmentPointerWithUrl = {
      url: 'url',
      contentType: 'contentType',
      id: 1234,
    };
    const attachments = new Array<AttachmentPointerWithUrl>();
    attachments.push(attachment);

    const message = new VisibleMessage({
      timestamp: Date.now(),
      attachments,
      ...sharedNoExpire,
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
      ...sharedNoExpire,
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    const message = new VisibleMessage({
      timestamp: Date.now(),
      ...sharedNoExpire,
    });

    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
