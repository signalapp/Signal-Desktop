import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { DeviceUnlinkMessage } from '../../../../session/messages/outgoing';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';

describe('DeviceUnlinkMessage', () => {
  let message: DeviceUnlinkMessage;
  beforeEach(() => {
    const timestamp = Date.now();
    message = new DeviceUnlinkMessage({ timestamp });
  });

  it('content of just the UNPAIRING_REQUEST flag set', () => {
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.dataMessage).to.have.property(
      'flags',
      SignalService.DataMessage.Flags.UNPAIRING_REQUEST
    );
  });

  it('correct ttl', () => {
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.DEVICE_UNPAIRING);
  });

  it('has an identifier', () => {
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
