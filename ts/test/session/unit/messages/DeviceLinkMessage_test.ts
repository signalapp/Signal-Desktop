import { expect } from 'chai';
import { beforeEach } from 'mocha';

import {
  DeviceLinkGrantMessage,
  DeviceLinkRequestMessage,
} from '../../../../session/messages/outgoing';
import { SignalService } from '../../../../protobuf';
import { LokiProfile } from '../../../../types/Message';
import { Constants } from '../../../../session';

describe('DeviceLinkMessage', () => {
  let linkRequestMessage: DeviceLinkRequestMessage;
  let linkGrantMessage: DeviceLinkGrantMessage;
  let lokiProfile: LokiProfile;

  beforeEach(() => {
    linkRequestMessage = new DeviceLinkRequestMessage({
      timestamp: Date.now(),
      primaryDevicePubKey: '111111',
      secondaryDevicePubKey: '222222',
      requestSignature: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });

    lokiProfile = {
      displayName: 'displayName',
      avatarPointer: 'avatarPointer',
      profileKey: new Uint8Array([1, 2, 3, 4]),
    };

    linkGrantMessage = new DeviceLinkGrantMessage({
      timestamp: Date.now(),
      primaryDevicePubKey: '111111',
      secondaryDevicePubKey: '222222',
      requestSignature: new Uint8Array([1, 2, 3, 4, 5, 6]),
      grantSignature: new Uint8Array([6, 5, 4, 3, 2, 1]),
      lokiProfile,
    });
  });

  describe('content of a linkRequestMessage ', () => {
    let decoded: any;
    before(() => {
      const plainText = linkRequestMessage.plainTextBuffer();
      decoded = SignalService.Content.decode(plainText);
    });

    it('has a pairingAuthorisation.primaryDevicePubKey', () => {
      expect(decoded.pairingAuthorisation).to.have.property(
        'primaryDevicePubKey',
        '111111'
      );
    });
    it('has a pairingAuthorisation.secondaryDevicePubKey', () => {
      expect(decoded.pairingAuthorisation).to.have.property(
        'secondaryDevicePubKey',
        '222222'
      );
    });
    it('has a pairingAuthorisation.requestSignature', () => {
      expect(decoded.pairingAuthorisation)
        .to.have.property('requestSignature')
        .to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });
    it('has no pairingAuthorisation.grantSignature', () => {
      expect(decoded.pairingAuthorisation)
        .to.have.property('grantSignature')
        .to.have.lengthOf(0);
    });
    it('has no lokiProfile', () => {
      expect(decoded).to.not.have.property('lokiProfile');
    });
  });

  describe('content of a linkGrantMessage ', () => {
    let decoded: any;
    before(() => {
      const plainText = linkGrantMessage.plainTextBuffer();
      decoded = SignalService.Content.decode(plainText);
    });

    it('has a pairingAuthorisation.primaryDevicePubKey', () => {
      expect(decoded.pairingAuthorisation).to.have.property(
        'primaryDevicePubKey',
        '111111'
      );
    });
    it('has a pairingAuthorisation.secondaryDevicePubKey', () => {
      expect(decoded.pairingAuthorisation).to.have.property(
        'secondaryDevicePubKey',
        '222222'
      );
    });
    it('has a pairingAuthorisation.requestSignature', () => {
      expect(decoded.pairingAuthorisation)
        .to.have.property('requestSignature')
        .to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });
    it('has a pairingAuthorisation.grantSignature', () => {
      expect(decoded.pairingAuthorisation)
        .to.have.property('grantSignature')
        .to.deep.equal(new Uint8Array([6, 5, 4, 3, 2, 1]));
    });
    it('has a lokiProfile', () => {
      expect(decoded.dataMessage)
        .to.have.property('profileKey')
        .to.be.deep.equal(lokiProfile.profileKey);
      expect(decoded.dataMessage)
        .to.have.property('profile')
        .to.have.property('displayName')
        .to.be.deep.equal('displayName');
      expect(decoded.dataMessage)
        .to.have.property('profile')
        .to.have.property('avatar')
        .to.be.deep.equal('avatarPointer');
    });
  });

  it('correct ttl', () => {
    expect(linkRequestMessage.ttl()).to.equal(
      Constants.TTL_DEFAULT.PAIRING_REQUEST
    );
    expect(linkGrantMessage.ttl()).to.equal(
      Constants.TTL_DEFAULT.PAIRING_REQUEST
    );
  });

  it('has an identifier', () => {
    expect(linkRequestMessage.identifier).to.not.equal(
      null,
      'identifier cannot be null'
    );
    expect(linkRequestMessage.identifier).to.not.equal(
      undefined,
      'identifier cannot be undefined'
    );
  });
});
