import { expect } from 'chai';

import { SignalService } from '../../../../../../protobuf';
import { GroupPromoteMessage } from '../../../../../../session/messages/outgoing/controlMessage/group/v3/GroupPromoteMessage';
import { v4 } from 'uuid';
import { Constants } from '../../../../../../session';
import { from_hex } from 'libsodium-wrappers-sumo';

describe('GroupPromoteMessage', () => {
  it('can create valid message', () => {
    const message = new GroupPromoteMessage({
      timestamp: 12345,
      identifier: v4(),
      privateKey: '1234',
    });

    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage)
      .to.have.property('groupMessage')
      .to.have.property('promoteMessage')
      .to.have.deep.property('privateKey', from_hex('1234'));
    expect(message)
      .to.have.property('timestamp')
      .to.be.equal(12345);
  });

  it('correct ttl', () => {
    const message = new GroupPromoteMessage({
      timestamp: 12345,
      identifier: v4(),
      privateKey: '1234',
    });

    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TTL_MAX);
  });

  it('has an identifier even if none are provided', () => {
    const message = new GroupPromoteMessage({
      timestamp: 12345,
      privateKey: '1234',
    });

    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });

  describe('constructor throws on invalid ', () => {
    it('privateKey empty', () => {
      expect(() => {
        new GroupPromoteMessage({
          timestamp: 12345,
          privateKey: null as any,
        });
      }).throws();
    });
  });
});
