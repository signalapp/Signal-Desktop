import { expect } from 'chai';

import Long from 'long';
import { toNumber } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { TypingMessage } from '../../../../session/messages/outgoing/controlMessage/TypingMessage';

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
    const decodedtimestamp = toNumber(decoded.typingMessage?.timestamp);
    expect(decodedtimestamp).to.be.equal(111111111);
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

  it('correct ttl', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TYPING_MESSAGE);
  });

  it('has an identifier', () => {
    const message = new TypingMessage({
      timestamp: Date.now(),
      isTyping: true,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
