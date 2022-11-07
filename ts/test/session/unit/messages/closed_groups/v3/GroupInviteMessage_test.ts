import { expect } from 'chai';

import { SignalService } from '../../../../../../protobuf';
import { GroupInviteMessage } from '../../../../../../session/messages/outgoing/controlMessage/group/v3/GroupInviteMessage';
import { v4 } from 'uuid';
import { Constants } from '../../../../../../session';
import { from_hex } from 'libsodium-wrappers-sumo';

describe('GroupInviteMessage', () => {
  it('can create valid message', () => {
    const message = new GroupInviteMessage({
      timestamp: 12345,
      memberPrivateKey: '654321',
      name: 'groupName',
      identifier: v4(),
    });

    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage)
      .to.have.property('groupMessage')
      .to.have.property('inviteMessage')
      .to.have.deep.property('name', 'groupName');
    expect(decoded.dataMessage)
      .to.have.property('groupMessage')
      .to.have.property('inviteMessage')
      .to.have.deep.property('memberPrivateKey', from_hex('654321'));

    expect(message)
      .to.have.property('timestamp')
      .to.be.equal(12345);
  });

  it('correct ttl', () => {
    const message = new GroupInviteMessage({
      timestamp: 12345,
      memberPrivateKey: '654321',
      name: 'groupName',
      identifier: v4(),
    });

    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TTL_MAX);
  });

  it('has an identifier even if none are provided', () => {
    const message = new GroupInviteMessage({
      timestamp: 12345,
      memberPrivateKey: '654321',
      name: 'groupName',
    });

    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });

  describe('constructor throws on invalid ', () => {
    it('memberPk is empty', () => {
      expect(() => {
        new GroupInviteMessage({
          timestamp: 12345,
          memberPrivateKey: undefined as any,
          name: 'groupName',
        });
      }).throws();
    });

    it('memberPk is not a string', () => {
      expect(() => {
        new GroupInviteMessage({
          timestamp: 12345,
          memberPrivateKey: 1234 as any,
          name: 'groupName',
        });
      }).throws();
    });

    it('memberPk is not a hex string', () => {
      expect(() => {
        new GroupInviteMessage({
          timestamp: 12345,
          memberPrivateKey: '03ghklmnopqrstuvxyz' as any,
          name: 'groupName',
        });
      }).throws();
    });
  });
});
