import { expect } from 'chai';

import {
  ChatMessage,
  ClosedGroupV2ChatMessage,
} from '../../../../session/messages/outgoing';
import { SignalService } from '../../../../protobuf';
import { TestUtils } from '../../../test-utils';
import { StringUtils } from '../../../../session/utils';
import { PubKey } from '../../../../session/types';
import { Constants } from '../../../../session';

describe('ClosedGroupV2ChatMessage', () => {
  let groupId: PubKey;
  beforeEach(() => {
    groupId = TestUtils.generateFakePubKey();
  });
  it('can create empty message with timestamp, groupId and chatMessage', () => {
    const chatMessage = new ChatMessage({
      timestamp: Date.now(),
      body: 'body',
    });
    const message = new ClosedGroupV2ChatMessage({
      groupId,
      chatMessage,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage)
      .to.have.property('group')
      .to.have.deep.property(
        'id',
        new Uint8Array(
          StringUtils.encode(
            PubKey.PREFIX_GROUP_TEXTSECURE + groupId.key,
            'utf8'
          )
        )
      );
    expect(decoded.dataMessage)
      .to.have.property('group')
      .to.have.deep.property('type', SignalService.GroupContext.Type.DELIVER);

    expect(decoded.dataMessage).to.have.deep.property('body', 'body');

    // we use the timestamp of the chatMessage as parent timestamp
    expect(message)
      .to.have.property('timestamp')
      .to.be.equal(chatMessage.timestamp);
  });

  it('correct ttl', () => {
    const chatMessage = new ChatMessage({
      timestamp: Date.now(),
    });
    const message = new ClosedGroupV2ChatMessage({
      groupId,
      chatMessage,
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.REGULAR_MESSAGE);
  });

  it('has an identifier', () => {
    const chatMessage = new ChatMessage({
      timestamp: Date.now(),
    });
    const message = new ClosedGroupV2ChatMessage({
      groupId,
      chatMessage,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });

  it('should use the identifier passed into it over the one set in chatMessage', () => {
    const chatMessage = new ChatMessage({
      timestamp: Date.now(),
      body: 'body',
      identifier: 'chatMessage',
    });
    const message = new ClosedGroupV2ChatMessage({
      groupId,
      chatMessage,
      identifier: 'closedGroupMessage',
    });
    expect(message.identifier).to.be.equal('closedGroupMessage');
  });

  it('should use the identifier of the chatMessage if one is not specified on the closed group message', () => {
    const chatMessage = new ChatMessage({
      timestamp: Date.now(),
      body: 'body',
      identifier: 'chatMessage',
    });
    const message = new ClosedGroupV2ChatMessage({
      groupId,
      chatMessage,
    });
    expect(message.identifier).to.be.equal('chatMessage');
  });
});
