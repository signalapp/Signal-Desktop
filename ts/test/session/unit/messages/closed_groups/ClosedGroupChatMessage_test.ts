import { expect } from 'chai';

import { SignalService } from '../../../../../protobuf';
import { Constants } from '../../../../../session';
import { ClosedGroupVisibleMessage } from '../../../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { VisibleMessage } from '../../../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { PubKey } from '../../../../../session/types';
import { StringUtils } from '../../../../../session/utils';
import { TestUtils } from '../../../../test-utils';

describe('ClosedGroupVisibleMessage', () => {
  let groupId: PubKey;
  beforeEach(() => {
    groupId = TestUtils.generateFakePubKey();
  });
  it('can create empty message with timestamp, groupId and chatMessage', () => {
    const timestamp = Date.now();
    const chatMessage = new VisibleMessage({
      timestamp,
      body: 'body',
      expirationType: null,
      expireTimer: null,
    });
    const message = new ClosedGroupVisibleMessage({
      groupId,
      timestamp,
      chatMessage,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage)
      .to.have.property('group')
      .to.have.deep.property(
        'id',
        new Uint8Array(StringUtils.encode(PubKey.PREFIX_GROUP_TEXTSECURE + groupId.key, 'utf8'))
      );
    expect(decoded.dataMessage)
      .to.have.property('group')
      .to.have.deep.property('type', SignalService.GroupContext.Type.DELIVER);

    expect(decoded.dataMessage).to.have.deep.property('body', 'body');

    // we use the timestamp of the chatMessage as parent timestamp
    expect(message).to.have.property('timestamp').to.be.equal(chatMessage.timestamp);
  });

  it('correct ttl', () => {
    const timestamp = Date.now();
    const chatMessage = new VisibleMessage({
      timestamp,
      expirationType: null,
      expireTimer: null,
    });
    const message = new ClosedGroupVisibleMessage({
      groupId,
      timestamp,
      chatMessage,
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    const timestamp = Date.now();
    const chatMessage = new VisibleMessage({
      timestamp,
      expirationType: null,
      expireTimer: null,
    });
    const message = new ClosedGroupVisibleMessage({
      groupId,
      timestamp,
      chatMessage,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });

  it('should use the identifier passed into it over the one set in chatMessage', () => {
    const timestamp = Date.now();
    const chatMessage = new VisibleMessage({
      timestamp,
      body: 'body',
      identifier: 'chatMessage',
      expirationType: null,
      expireTimer: null,
    });
    const message = new ClosedGroupVisibleMessage({
      groupId,
      timestamp,
      chatMessage,
      identifier: 'closedGroupMessage',
    });
    expect(message.identifier).to.be.equal('closedGroupMessage');
  });

  it('should use the identifier of the chatMessage if one is not specified on the closed group message', () => {
    const timestamp = Date.now();
    const chatMessage = new VisibleMessage({
      timestamp,
      body: 'body',
      identifier: 'chatMessage',
      expirationType: null,
      expireTimer: null,
    });
    const message = new ClosedGroupVisibleMessage({
      groupId,
      timestamp,
      chatMessage,
    });
    expect(message.identifier).to.be.equal('chatMessage');
  });
});
