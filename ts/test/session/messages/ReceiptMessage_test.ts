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
        const identifier = '123456';
        readMessage = new ReadReceiptMessage({timestamp, identifier, timestamps});
        deliveryMessage = new DeliveryReceiptMessage({timestamp, identifier, timestamps});
    });

    it('content of a read receipt is correct', () => {
        const plainText = readMessage.plainTextBuffer();
        const decoded = SignalService.Content.toObject(SignalService.Content.decode(plainText));

        expect(decoded.receiptMessage).to.have.property('type', 1);
        expect(decoded.receiptMessage.timestamp).to.have.lengthOf(2);
        expect(decoded.receiptMessage.timestamp[0]).to.have.property('low', timestamps[0]);
        expect(decoded.receiptMessage.timestamp[1]).to.have.property('low', timestamps[1]);
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
});
