import { expect } from 'chai';
import { beforeEach} from 'mocha';

import { DeliveryReceiptMessage, ReadReceiptMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';

describe('ReceiptMessage', () => {
    let readMessage: ReadReceiptMessage;
    let deliveryMessage: ReadReceiptMessage;
    let timestamps: Array<number>;

    beforeEach(() => {
        timestamps = [987654321, 123456789];
        const timestamp = Date.now();
        readMessage = new ReadReceiptMessage({timestamp, timestamps});
        deliveryMessage = new DeliveryReceiptMessage({timestamp, timestamps});
    });

    it('content of a read receipt is correct', () => {
        const plainText = readMessage.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.receiptMessage).to.have.property('type', 1);
        expect(decoded.receiptMessage.timestamp).to.have.lengthOf(2);
        const timestamp0 = decoded.receiptMessage.timestamp[0].toNumber();
        const timestamp1 = decoded.receiptMessage.timestamp[1].toNumber();
        expect(timestamp0).to.have.be.equal(timestamps[0]);
        expect(timestamp1).to.have.be.equal(timestamps[1]);
    });

    it('content of a delivery receipt is correct', () => {
        const plainText = deliveryMessage.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.receiptMessage).to.have.property('type', 0);
        expect(decoded.receiptMessage.timestamp).to.have.lengthOf(2);
        expect(decoded.receiptMessage.timestamp[0]).to.have.property('low', timestamps[0]);
        expect(decoded.receiptMessage.timestamp[1]).to.have.property('low', timestamps[1]);
    });

    it('ttl of 1 day', () => {
        expect(readMessage.ttl()).to.equal(24 * 60 * 60 * 1000);
        expect(deliveryMessage.ttl()).to.equal(24 * 60 * 60 * 1000);
    });

    it('has an identifier', () => {
        expect(readMessage.identifier).to.not.equal(null,  'identifier cannot be null');
        expect(readMessage.identifier).to.not.equal(undefined,  'identifier cannot be undefined');
    });
});
