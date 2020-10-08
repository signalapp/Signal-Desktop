import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { SessionEstablishedMessage } from '../../../../session/messages/outgoing';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';

describe('SessionEstablishedMessage', () => {
  let message: SessionEstablishedMessage;
  beforeEach(() => {
    const timestamp = Date.now();
    message = new SessionEstablishedMessage({ timestamp });
  });

  it('has a nullMessage not null', () => {
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.nullMessage).to.be.not.equal(
      null,
      'decoded.dataMessage.nullMessage should not be null'
    );
  });

  it('correct ttl', () => {
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.SESSION_ESTABLISHED);
  });

  it('has an identifier', () => {
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
