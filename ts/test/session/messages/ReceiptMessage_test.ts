import { expect } from 'chai';
import { beforeEach } from 'mocha';

import {
  DeliveryReceiptMessage,
  ReadReceiptMessage,
} from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { toNumber } from 'lodash';
import { Constants } from '../../../session';

describe('ReceiptMessage', () => {
  let readMessage: ReadReceiptMessage;
  let deliveryMessage: ReadReceiptMessage;
  let timestamps: Array<number>;

  beforeEach(() => {
    timestamps = [987654321, 123456789];
    const timestamp = Date.now();
    readMessage = new ReadReceiptMessage({ timestamp, timestamps });
    deliveryMessage = new DeliveryReceiptMessage({ timestamp, timestamps });
  });

  it('content of a read receipt is correct', () => {
    const plainText = readMessage.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.receiptMessage).to.have.property('type', 1);
    const decodedTimestamps = (decoded.receiptMessage?.timestamp ?? []).map(
      toNumber
    );
    expect(decodedTimestamps).to.deep.equal(timestamps);
  });

  it('content of a delivery receipt is correct', () => {
    const plainText = deliveryMessage.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.receiptMessage).to.have.property('type', 0);
    const decodedTimestamps = (decoded.receiptMessage?.timestamp ?? []).map(
      toNumber
    );
    expect(decodedTimestamps).to.deep.equal(timestamps);
  });

  it('correct ttl', () => {
    expect(readMessage.ttl()).to.equal(Constants.TTL_DEFAULT.REGULAR_MESSAGE);
    expect(deliveryMessage.ttl()).to.equal(
      Constants.TTL_DEFAULT.REGULAR_MESSAGE
    );
  });

  it('has an identifier', () => {
    expect(readMessage.identifier).to.not.equal(
      null,
      'identifier cannot be null'
    );
    expect(readMessage.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
