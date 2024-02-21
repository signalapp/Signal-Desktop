import { expect } from 'chai';
import { toNumber } from 'lodash';
import { beforeEach } from 'mocha';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { ReadReceiptMessage } from '../../../../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage';

describe('ReceiptMessage', () => {
  let readMessage: ReadReceiptMessage;
  let timestamps: Array<number>;

  beforeEach(() => {
    timestamps = [987654321, 123456789];
    const timestamp = Date.now();
    readMessage = new ReadReceiptMessage({ timestamp, timestamps });
  });

  it('content of a read receipt is correct', () => {
    const plainText = readMessage.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.receiptMessage).to.have.property('type', 1);
    const decodedTimestamps = (decoded.receiptMessage?.timestamp ?? []).map(toNumber);
    expect(decodedTimestamps).to.deep.equal(timestamps);
  });

  it('correct ttl', () => {
    expect(readMessage.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    expect(readMessage.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(readMessage.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
