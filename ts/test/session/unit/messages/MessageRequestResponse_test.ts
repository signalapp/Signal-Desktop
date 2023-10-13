import { expect } from 'chai';
import { v4 } from 'uuid';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { MessageRequestResponse } from '../../../../session/messages/outgoing/controlMessage/MessageRequestResponse';

describe('MessageRequestResponse', () => {
  let message: MessageRequestResponse | undefined;
  it('correct ttl', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
    });

    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
    });

    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });

  it('has an identifier matching if given', () => {
    const identifier = v4();
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      identifier,
    });

    expect(message.identifier).to.not.equal(identifier, 'identifier should match');
  });

  it('isApproved is always true', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.messageRequestResponse)
      .to.have.property('isApproved')
      .to.be.eq(true, 'isApproved is true');
  });

  it('can create response without lokiProfile', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.messageRequestResponse)
      .to.have.property('profile')
      .to.be.eq(null, 'no profile field if no profile given');
  });

  it('can create response with display name only', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      lokiProfile: { displayName: 'Jane', profileKey: null },
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');
    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('empty profileKey does not get included', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      lokiProfile: { displayName: 'Jane', profileKey: new Uint8Array(0) },
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.eq('Jane');

    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('can create response with display name and profileKey and profileImage', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      lokiProfile: {
        displayName: 'Jane',
        profileKey: new Uint8Array([1, 2, 3, 4, 5, 6]),
        avatarPointer: 'https://somevalidurl.com',
      },
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    expect(decoded.messageRequestResponse?.profileKey).to.be.not.empty;

    if (!decoded.messageRequestResponse?.profileKey?.buffer) {
      throw new Error('decoded.messageRequestResponse?.profileKey?.buffer should be set');
    }
    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.eq(
      'https://somevalidurl.com'
    );
    // don't ask me why deep.eq ([1,2,3, ...]) gives nothing interesting but a 8192 buffer not matching
    expect(decoded.messageRequestResponse?.profileKey.length).to.be.eq(6);
    expect(decoded.messageRequestResponse?.profileKey[0]).to.be.eq(1);
    expect(decoded.messageRequestResponse?.profileKey[1]).to.be.eq(2);
    expect(decoded.messageRequestResponse?.profileKey[2]).to.be.eq(3);
    expect(decoded.messageRequestResponse?.profileKey[3]).to.be.eq(4);
    expect(decoded.messageRequestResponse?.profileKey[4]).to.be.eq(5);
    expect(decoded.messageRequestResponse?.profileKey[5]).to.be.eq(6);
  });

  it('profileKey not included if profileUrl not set', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      lokiProfile: { displayName: 'Jane', profileKey: new Uint8Array([1, 2, 3, 4, 5, 6]) },
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    if (!decoded.messageRequestResponse?.profileKey?.buffer) {
      throw new Error('decoded.messageRequestResponse?.profileKey?.buffer should be set');
    }

    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('url not included if profileKey not set', () => {
    message = new MessageRequestResponse({
      timestamp: Date.now(),
      lokiProfile: {
        displayName: 'Jane',
        profileKey: null,
        avatarPointer: 'https://somevalidurl.com',
      },
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    if (!decoded.messageRequestResponse?.profileKey?.buffer) {
      throw new Error('decoded.messageRequestResponse?.profileKey?.buffer should be set');
    }

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.eq('Jane');
    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });
});
