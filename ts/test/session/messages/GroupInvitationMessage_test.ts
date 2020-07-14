import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { GroupInvitationMessage } from '../../../session/messages/outgoing';
import { SignalService } from '../../../protobuf';
import { Constants } from '../../../session';

describe('GroupInvitationMessage', () => {
  let message: GroupInvitationMessage;
  const timestamp = Date.now();
  const serverAddress = 'http://localhost';
  const channelId = 1;
  const serverName = 'test';

  beforeEach(() => {
    message = new GroupInvitationMessage({
      timestamp,
      serverAddress,
      channelId,
      serverName,
    });
  });

  it('dataMessage.groupInvitation has serverAddress, channelId, and serverName set', () => {
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.dataMessage?.groupInvitation).to.have.property(
      'serverAddress',
      serverAddress
    );
    expect(decoded.dataMessage?.groupInvitation).to.have.property(
      'channelId',
      channelId
    );
    expect(decoded.dataMessage?.groupInvitation).to.have.property(
      'serverName',
      serverName
    );
  });

  it('correct ttl', () => {
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.REGULAR_MESSAGE);
  });

  it('has an identifier', () => {
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
