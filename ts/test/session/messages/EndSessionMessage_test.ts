import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { EndSessionMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('EndSessionMessage', () => {
    let message: EndSessionMessage;
    beforeEach(() => {
        const timestamp = Date.now();
        const preKeyBundle = {deviceId: 123456};
        message = new EndSessionMessage({timestamp, preKeyBundle});
    });

    it('has a preKeyBundle', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.preKeyBundleMessage).to.have.property('deviceId', 123456);
    });

    it('has a dataMessage with `END_SESSION` flag and `TERMINATE` as body', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.dataMessage).to.have.property('flags', SignalService.DataMessage.Flags.END_SESSION);
        expect(decoded.dataMessage).to.have.deep.property('body', 'TERMINATE');
    });

    it('ttl of 4 days', () => {
        expect(message.ttl()).to.equal(4 * 24 * 60 * 60 * 1000);
    });
});
