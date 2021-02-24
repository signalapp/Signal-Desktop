import { expect } from 'chai';
import { ECKeyPair } from '../../../../receiver/keypairs';

import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
} from '../../../../session/messages/outgoing/content/ConfigurationMessage';
import { TestUtils } from '../../../test-utils';

// tslint:disable-next-line: max-func-body-length
describe('ConfigurationMessage', () => {
  it('throw if closed group is not set', () => {
    const activeClosedGroups = null as any;
    const params = {
      activeClosedGroups,
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: 'displayName',
    };
    expect(() => new ConfigurationMessage(params)).to.throw(
      'closed group must be set'
    );
  });

  it('throw if open group is not set', () => {
    const activeOpenGroups = null as any;
    const params = {
      activeClosedGroups: [],
      activeOpenGroups,
      timestamp: Date.now(),
      displayName: 'displayName',
    };
    expect(() => new ConfigurationMessage(params)).to.throw(
      'open group must be set'
    );
  });

  it('throw if display name is not set', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: undefined as any,
    };
    expect(() => new ConfigurationMessage(params)).to.throw(
      'displayName must be set'
    );
  });

  it('throw if display name is set but empty', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: undefined as any,
    };
    expect(() => new ConfigurationMessage(params)).to.throw(
      'displayName must be set'
    );
  });

  it('ttl is 4 days', () => {
    const params = {
      activeClosedGroups: [],
      activeOpenGroups: [],
      timestamp: Date.now(),
      displayName: 'displayName',
    };
    const configMessage = new ConfigurationMessage(params);
    expect(configMessage.ttl()).to.be.equal(4 * 24 * 60 * 60 * 1000);
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

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'name must be set'
      );
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

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'members must be set'
      );
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

      expect(() => new ConfigurationMessageClosedGroup(params)).to.throw(
        'admins must be set'
      );
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
});
