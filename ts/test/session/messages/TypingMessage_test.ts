import { expect } from 'chai';

import { TypingMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { TextEncoder } from 'util';

describe('TypingMessage', () => {
    it('has Action.STARTED if isTyping = true', () => {
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: true,
            typingTimestamp: null,
            groupId: null,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.typingMessage).to.have.property('action', SignalService.TypingMessage.Action.STARTED);
    });

    it('has Action.STOPPED if isTyping = false', () => {
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: false,
            typingTimestamp: null,
            groupId: null,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        expect(decoded.typingMessage).to.have.property('action', SignalService.TypingMessage.Action.STOPPED);
    });

    it('has typingTimestamp set if value passed', () => {
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: true,
            typingTimestamp: 111111111,
            groupId: null,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        const typingTimestamp = decoded.typingMessage.timestamp.toNumber();
        expect(typingTimestamp).to.be.equal(111111111);
    });

    it('has typingTimestamp set with Date.now() if value not passed', () => {
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: true,
            typingTimestamp: null,
            groupId: null,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        const typingTimestamp = decoded.typingMessage.timestamp.toNumber();
        expect(typingTimestamp).to.be.equal(Date.now());
    });

    it('has groupId set if a value given', () => {
        const groupId = '6666666666';
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: true,
            typingTimestamp: null,
            groupId,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));
        const manuallyEncodedGroupId = new TextEncoder().encode(groupId);

        expect(decoded.typingMessage.groupId).to.be.deep.equal(manuallyEncodedGroupId);
    });

    it('ttl of 1 minute', () => {
        const message = new TypingMessage({
            timestamp: Date.now(),
            identifier: '123456',
            isTyping: true,
            typingTimestamp: null,
            groupId: null,
        });
        expect(message.ttl()).to.equal(60 * 1000);
    });
});
