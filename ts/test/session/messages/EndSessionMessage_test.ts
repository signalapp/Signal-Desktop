import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { EndSessionMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { TextEncoder } from 'util';

describe('EndSessionMessage', () => {
    let message: EndSessionMessage;
    const preKeyBundle = {
        deviceId: 123456,
        preKeyId: 654321,
        signedKeyId: 111111,
        preKey: new TextEncoder().encode('preKey'),
        signature: new TextEncoder().encode('signature'),
        signedKey: new TextEncoder().encode('signedKey'),
        identityKey: new TextEncoder().encode('identityKey'),
    };

    beforeEach(() => {
        const timestamp = Date.now();
        message = new EndSessionMessage({timestamp, preKeyBundle});
    });

    it('has a preKeyBundle', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.decode(plainText);

        expect(decoded.preKeyBundleMessage).to.have.property('deviceId', preKeyBundle.deviceId);
        expect(decoded.preKeyBundleMessage).to.have.property('preKeyId', preKeyBundle.preKeyId);
        expect(decoded.preKeyBundleMessage).to.have.property('signedKeyId', preKeyBundle.signedKeyId);

        expect(decoded.preKeyBundleMessage).to.have.deep.property('signature', preKeyBundle.signature);
        expect(decoded.preKeyBundleMessage).to.have.deep.property('signedKey', preKeyBundle.signedKey);
        expect(decoded.preKeyBundleMessage).to.have.deep.property('identityKey', preKeyBundle.identityKey);
    });

    it('has a dataMessage with `END_SESSION` flag and `TERMINATE` as body', () => {
        const plainText = message.plainTextBuffer();
        const decoded = SignalService.Content.decode(plainText);

        expect(decoded.dataMessage).to.have.property('flags', SignalService.DataMessage.Flags.END_SESSION);
        expect(decoded.dataMessage).to.have.deep.property('body', 'TERMINATE');
    });

    it('ttl of 4 days', () => {
        expect(message.ttl()).to.equal(4 * 24 * 60 * 60 * 1000);
    });

    it('has an identifier', () => {
        expect(message.identifier).to.not.equal(null,  'identifier cannot be null');
        expect(message.identifier).to.not.equal(undefined,  'identifier cannot be undefined');
    });
});
