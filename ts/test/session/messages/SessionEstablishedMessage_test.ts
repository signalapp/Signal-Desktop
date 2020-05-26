import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { SessionEstablishedMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('SessionEstablishedMessage', () => {
    let message: SessionEstablishedMessage;
    beforeEach(() => {
        const timestamp = Date.now();
        const identifier = '123456';
        message = new SessionEstablishedMessage({timestamp, identifier});
    });

    it('has a nullMessage not null', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.nullMessage).to.be.not.equal(null, 'decoded.dataMessage.nullMessage should not be null');
    });

    it('ttl of 5 minutes', () => {
        expect(message.ttl()).to.equal(5 * 60 * 1000);
    });
});
