import { expect } from 'chai';
import { beforeEach } from 'mocha';

import {
  DeviceUnlinkMessage,
  SessionRequestMessage,
} from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { toRawMessage } from '../../../session/utils/Messages';
import { EncryptionType, PubKey, RawMessage } from '../../../session/types';
import { TestUtils } from '../../test-utils';
import { TextEncoder } from 'util';

describe('toRawMessage', () => {
  let message: DeviceUnlinkMessage;
  const pubkey: PubKey = TestUtils.generateFakePubkey();
  let raw: RawMessage;

  beforeEach(() => {
    const timestamp = Date.now();
    message = new DeviceUnlinkMessage({ timestamp });
    raw = toRawMessage(pubkey, message);
  });

  it('copied fields are set', () => {
    expect(raw).to.have.property('ttl', message.ttl());
    expect(raw)
      .to.have.property('plainTextBuffer')
      .to.be.deep.equal(message.plainTextBuffer());
    expect(raw).to.have.property('timestamp', message.timestamp);
    expect(raw).to.have.property('identifier', message.identifier);
    expect(raw).to.have.property('device', pubkey.key);
  });

  it('encryption is set to SESSION_REQUEST if message is of instance SessionRequestMessage', () => {
    const preKeyBundle = {
      deviceId: 123456,
      preKeyId: 654321,
      signedKeyId: 111111,
      preKey: new TextEncoder().encode('preKey'),
      signature: new TextEncoder().encode('signature'),
      signedKey: new TextEncoder().encode('signedKey'),
      identityKey: new TextEncoder().encode('identityKey'),
    };
    const sessionRequest = new SessionRequestMessage({
      timestamp: Date.now(),
      preKeyBundle,
    });
    const sessionRequestRaw = toRawMessage(pubkey, sessionRequest);
    expect(sessionRequestRaw).to.have.property(
      'encryption',
      EncryptionType.SessionRequest
    );
  });

  it('encryption is set to Signal if message is not of instance SessionRequestMessage', () => {
    expect(raw).to.have.property('encryption', EncryptionType.Signal);
  });
});
