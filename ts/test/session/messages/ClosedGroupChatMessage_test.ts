import { expect } from 'chai';

import {  ChatMessage,  ClosedGroupChatMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { TextEncoder } from 'util';

describe('ClosedGroupChatMessage', () => {
    it('can create empty message with timestamp, groupId and chatMessage', () => {
        const chatMessage = new ChatMessage({
            timestamp: Date.now(),
            body: 'body',
        });
        const message = new ClosedGroupChatMessage({
            groupId: '12',
            chatMessage,
        });
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.decode(plainText);
        expect(decoded.dataMessage).to.have.property('group').to.have.deep.property('id', new TextEncoder().encode('12'));
        expect(decoded.dataMessage).to.have.property('group').to.have.deep.property('type', SignalService.GroupContext.Type.DELIVER);

        expect(decoded.dataMessage).to.have.deep.property('body', 'body');

        // we use the timestamp of the chatMessage as parent timestamp
        expect(message).to.have.property('timestamp').to.be.equal(chatMessage.timestamp);
    });

    it('ttl of 1 day', () => {
        const chatMessage = new ChatMessage({
            timestamp: Date.now(),
        });
        const message = new ClosedGroupChatMessage({
            groupId: '12',
            chatMessage,
        });
        expect(message.ttl()).to.equal(24 * 60 * 60 * 1000);
    });

    it('has an identifier', () => {
        const chatMessage = new ChatMessage({
            timestamp: Date.now(),
        });
        const message = new ClosedGroupChatMessage({
            groupId: '12',
            chatMessage,
        });
        expect(message.identifier).to.not.equal(null,  'identifier cannot be null');
        expect(message.identifier).to.not.equal(undefined,  'identifier cannot be undefined');
    });
});
