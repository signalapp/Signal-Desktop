import { expect } from 'chai';

import { TypingMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { TextEncoder } from 'util';
import Long from 'long';

describe('TypingMessage', () => {
  it('has Action.STARTED if isTyping = true', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.typingMessage).to.have.property(
      'action',
      SignalService.TypingMessage.Action.STARTED
    );
  });

  it('has Action.STOPPED if isTyping = false', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: false,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.typingMessage).to.have.property(
      'action',
      SignalService.TypingMessage.Action.STOPPED
    );
  });

  it('has typingTimestamp set if value passed', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
      typingTimestamp: 111111111,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.typingMessage?.timestamp).to.have.property('low', 111111111);
  });

  it('has typingTimestamp set with Date.now() if value not passed', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    let timestamp = decoded.typingMessage?.timestamp;
    if (timestamp instanceof Long) {
      timestamp = timestamp.toNumber();
    }
    expect(timestamp).to.be.approximately(Date.now(), 10);
  });

  it('has groupId set if a value given', () => {
    const groupId = '6666666666';
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
      groupId,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const manuallyEncodedGroupId = new TextEncoder().encode(groupId);

    expect(decoded.typingMessage?.groupId).to.be.deep.equal(
      manuallyEncodedGroupId
    );
  });

  it('ttl of 1 minute', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    expect(message.ttl()).to.equal(60 * 1000);
  });

  it('has an identifier', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
