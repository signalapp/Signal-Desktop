import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { GroupInvitationMessage } from '../../../../session/messages/outgoing/visibleMessage/GroupInvitationMessage';

describe('GroupInvitationMessage', () => {
  let message: GroupInvitationMessage;
  const timestamp = Date.now();
  const url = 'http://localhost';
  const name = 'test';

  beforeEach(() => {
    message = new GroupInvitationMessage({
      timestamp,
      url,
      name,
      expirationType: null,
      expireTimer: null,
    });
  });

  it('dataMessage.groupInvitation has url, and serverName set', () => {
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.dataMessage?.openGroupInvitation).to.have.property('url', url);
    expect(decoded.dataMessage?.openGroupInvitation).to.have.property('name', name);
  });

  it('correct ttl', () => {
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
