import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { SessionResetMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('SessionResetMessage', () => {
    let message: SessionResetMessage;
    beforeEach(() => {
        const timestamp = Date.now();
        const identifier = '123456';
        const preKeyBundle = {deviceId: 123456};
        message = new SessionResetMessage({timestamp, identifier, preKeyBundle});
    });

    it('has a preKeyBundle', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.preKeyBundleMessage).to.have.property('deviceId', 123456);
    });

    it('has a nullMessage not null', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.nullMessage).to.be.not.equal(null, 'decoded.dataMessage.nullMessage should not be null');
    });

    it('ttl of 4 days', () => {
        expect(message.ttl()).to.equal(4 * 24 * 60 * 60 * 1000);
    });
});
