import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { DeviceUnlinkMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('DeviceUnlinkMessage', () => {
    let message: DeviceUnlinkMessage;
    beforeEach(() => {
        const timestamp = Date.now();
        message = new DeviceUnlinkMessage({timestamp});
    });

    it('content of just the UNPAIRING_REQUEST flag set', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.dataMessage).to.have.property('flags', SignalService.DataMessage.Flags.UNPAIRING_REQUEST);
    });

    it('ttl of 4 days', () => {
        expect(message.ttl()).to.equal(4 * 24 * 60 * 60 * 1000);
    });
});
