import { expect } from 'chai';
import { ECKeyPair } from '../../../../receiver/keypairs';
import { TTL_DEFAULT } from '../../../../session/constants';

import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
  ConfigurationMessageContact,
} from '../../../../session/messages/outgoing/controlMessage/ConfigurationMessage';
import { TestUtils } from '../../../test-utils';

describe('ConfigurationMessage', () => {
  it('throw if closed group is not set', () => {
    const activeClosedGroups = null as any;
    const params = {
      activeClosedGroups,
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: 'displayName',
      contacts: [],
    };
    expect(() => new ConfigurationMessage(params)).to.throw('closed group must be set');
  });

  it('throw if open group is not set', () => {
    const activeOpenGroups = null as any;
    const params = {
      activeClosedGroups: [],
      activeOpenGroups,
      timestamp: Date.now(),
      displayName: 'displayName',
      contacts: [],
    };
    expect(() => new ConfigurationMessage(params)).to.throw('open group must be set');
  });

  it('throw if display name is not set', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: undefined as any,
      contacts: [],
    };
    expect(() => new ConfigurationMessage(params)).to.throw('displayName must be set');
  });

  it('throw if display name is set but empty', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: undefined as any,
      contacts: [],
    };
    expect(() => new ConfigurationMessage(params)).to.throw('displayName must be set');
  });

  it('ttl is 4 days', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: 'displayName',
      contacts: [],
    };
    const configMessage = new ConfigurationMessage(params);
    expect(configMessage.ttl()).to.be.equal(TTL_DEFAULT.CONTENT_MESSAGE);
  });

  describe('ConfigurationMessageClosedGroup', () => {
    it('throw if closed group has no encryptionkeypair', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [member],
        admins: [member],
        encryptionKeyPair: undefined as any,
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'Encryption key pair looks invalid'
      );
    });

    it('throw if closed group has invalid encryptionkeypair', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [member],
        admins: [member],
        encryptionKeyPair: new ECKeyPair(new Uint8Array(), new Uint8Array()),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'Encryption key pair looks invalid'
      );
    });

    it('throw if closed group has invalid pubkey', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: 'invalidpubkey',
        name: 'groupname',
        members: [member],
        admins: [member],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw();
    });

    it('throw if closed group has invalid name', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: '',
        members: [member],
        admins: [member],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw('name must be set');
    });

    it('throw if members is empty', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [],
        admins: [member],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw('members must be set');
    });

    it('throw if admins is empty', () => {
      const member = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [member],
        admins: [],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw('admins must be set');
    });

    it('throw if some admins are not members', () => {
      const member = TestUtils.generateFakePubKey().key;
      const admin = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [member],
        admins: [admin],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'some admins are not members'
      );
    });
  });

  describe('ConfigurationMessageContact', () => {
    it('throws if contacts is not set', () => {
      const params = {
        activeClosedGroups: [],
        activeOpenGroups: [],
        timestamp: Date.now(),
        displayName: 'displayName',
        contacts: undefined as any,
      };
      expect(() => new ConfigurationMessage(params)).to.throw('contacts must be set');
    });
    it('throw if some admins are not members', () => {
      const member = TestUtils.generateFakePubKey().key;
      const admin = TestUtils.generateFakePubKey().key;
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        name: 'groupname',
        members: [member],
        admins: [admin],
        encryptionKeyPair: TestUtils.generateFakeECKeyPair(),
      };

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'some admins are not members'
      );
    });

    it('throw if the contact has not a valid pubkey', () => {
      const params = {
        publicKey: '05',
        displayName: 'contactDisplayName',
      };

      expect(() => new ConfigurationMessageContact(params)).to.throw();

      const params2 = {
        publicKey: undefined as any,
        displayName: 'contactDisplayName',
      };

      expect(() => new ConfigurationMessageContact(params2)).to.throw();
    });

    it('throw if the contact has an empty display name', () => {
      // a display name cannot be empty nor undefined

      expect(() => new ConfigurationMessageContact(params2)).to.throw();

      const params2 = {
        publicKey: TestUtils.generateFakePubKey().key,
        displayName: '',
      };

      expect(() => new ConfigurationMessageContact(params2)).to.throw();
    });

    it('throw if the contact has a profilePictureURL set but empty', () => {
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        displayName: 'contactDisplayName',
        profilePictureURL: '',
      };

      expect(() => new ConfigurationMessageContact(params)).to.throw(
        'profilePictureURL must either undefined or not empty'
      );
    });

    it('throw if the contact has a profileKey set but empty', () => {
      const params = {
        publicKey: TestUtils.generateFakePubKey().key,
        displayName: 'contactDisplayName',
        profileKey: new Uint8Array(),
      };

      expect(() => new ConfigurationMessageContact(params)).to.throw(
        'profileKey must either undefined or not empty'
      );
    });
  });
});
