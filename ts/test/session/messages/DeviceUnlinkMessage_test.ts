// tslint:disable: no-implicit-dependencies
import { assert} from 'chai';
import { beforeEach} from 'mocha';

import { DeviceUnlinkMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('DeviceUnlinkMessage', () => {
    let message: DeviceUnlinkMessage;
    beforeEach(() => {
        message = new DeviceUnlinkMessage(Date.now(), '123456');
    });

    it('content of just the UNPAIRING_REQUEST flag set', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.decode(plainText).toJSON();

        const expected = {
            dataMessage: {
                flags: SignalService.DataMessage.Flags.UNPAIRING_REQUEST,
            },
        };

        assert.deepEqual(decoded, expected);
    });

    it('ttl of 4 days', () => {
        assert.equal(message.ttl(), 4 * 24 * 60 * 60 * 1000);
    });
});
