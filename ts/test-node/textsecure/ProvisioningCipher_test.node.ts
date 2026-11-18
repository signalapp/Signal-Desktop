// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import ProvisioningCipher, {
  deriveKeys,
  IV_LENGTH,
  VERSION_BYTE,
} from '../../textsecure/ProvisioningCipher.node.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { generateKeyPair } from '../../Curve.node.ts';
import {
  encryptAes256CbcPkcsPadding,
  getRandomBytes,
  hmacSha256,
} from '../../Crypto.node.ts';
import { concatenate } from '../../Bytes.std.ts';
import {
  generateAci,
  generatePni,
} from '../../test-helpers/serviceIdUtils.std.ts';
import { toAciObject, toPniObject } from '../../util/ServiceId.node.ts';
import {
  isUntaggedPniString,
  toTaggedPni,
  toUntaggedPni,
} from '../../types/ServiceId.std.ts';
import { strictAssert } from '../../util/assert.std.ts';

import type { PublicKey } from '@signalapp/libsignal-client';

function buildProvisionMessage(
  overrides: Partial<Proto.ProvisionMessage> = {}
): Proto.ProvisionMessage {
  const aci = generateAci();
  const pni = generatePni();
  const aciIdentityKeyPair = generateKeyPair();
  const pniIdentityKeyPair = generateKeyPair();

  return {
    $unknown: [],
    aciIdentityKeyPublic: aciIdentityKeyPair.publicKey.serialize(),
    aciIdentityKeyPrivate: aciIdentityKeyPair.privateKey.serialize(),
    pniIdentityKeyPublic: pniIdentityKeyPair.publicKey.serialize(),
    pniIdentityKeyPrivate: pniIdentityKeyPair.privateKey.serialize(),
    aci,
    pni: toUntaggedPni(pni),
    number: '+16105550100',
    provisioningCode: 'provisioning-code',
    userAgent: 'OWD',
    profileKey: getRandomBytes(32),
    readReceipts: true,
    provisioningVersion: Proto.ProvisioningVersion.CURRENT,
    masterKey: getRandomBytes(32),
    ephemeralBackupKey: null,
    accountEntropyPool: 'a'.repeat(64),
    mediaRootBackupKey: null,
    aciBinary: toAciObject(aci).getRawUuidBytes(),
    pniBinary: toPniObject(pni).getRawUuidBytes(),
    authCredentialSalt: null,
    ...overrides,
  };
}

function encryptWithMacMissingVersionByte(
  message: Proto.ProvisionMessage,
  theirPublicKey: PublicKey
): Proto.ProvisionEnvelope {
  const ourKeyPair = generateKeyPair();
  const { cipherKey, macKey } = deriveKeys(
    theirPublicKey,
    ourKeyPair.privateKey
  );

  const iv = getRandomBytes(IV_LENGTH);
  const ciphertext = encryptAes256CbcPkcsPadding(
    cipherKey,
    Proto.ProvisionMessage.encode(message),
    iv
  );
  const mac = hmacSha256(macKey, concatenate([iv, ciphertext]));

  return {
    $unknown: [],
    publicKey: ourKeyPair.publicKey.serialize(),
    body: concatenate([new Uint8Array([VERSION_BYTE]), iv, ciphertext, mac]),
  };
}

function encodeAndDecodeProto(
  envelope: Proto.ProvisionEnvelope
): Proto.ProvisionEnvelope {
  return Proto.ProvisionEnvelope.decode(
    Proto.ProvisionEnvelope.encode(envelope)
  );
}

function provision(message: Proto.ProvisionMessage): {
  secondary: ProvisioningCipher;
  envelope: Proto.ProvisionEnvelope;
} {
  const secondary = new ProvisioningCipher();
  const secondaryPublicKey = secondary.getPublicKey();

  const primary = new ProvisioningCipher();
  const primaryPublicKey = primary.getPublicKey();
  const body = primary.encrypt(message, secondaryPublicKey);

  return {
    secondary,
    envelope: encodeAndDecodeProto({
      $unknown: [],
      publicKey: primaryPublicKey.serialize(),
      body,
    }),
  };
}

describe('textsecure/ProvisioningCipher', () => {
  describe('roundtrips', () => {
    it('a message for an account with a phone number', () => {
      const message = buildProvisionMessage();
      const { secondary, envelope } = provision(message);

      const result = secondary.decrypt(envelope);

      assert.deepEqual(
        result.aciKeyPair.privateKey.serialize(),
        message.aciIdentityKeyPrivate
      );
      assert.deepEqual(
        result.aciKeyPair.publicKey.serialize(),
        message.aciIdentityKeyPublic
      );
      assert.deepEqual(
        result.pniKeyPair?.publicKey.serialize(),
        message.pniIdentityKeyPublic
      );
      assert.deepEqual(
        result.pniKeyPair?.privateKey.serialize(),
        message.pniIdentityKeyPrivate
      );

      assert.strictEqual(result.aci, message.aci);

      const taggedPni = isUntaggedPniString(message.pni)
        ? toTaggedPni(message.pni)
        : undefined;
      assert.strictEqual(result.pni, taggedPni);

      assert.strictEqual(result.number, message.number);
      assert.strictEqual(result.provisioningCode, message.provisioningCode);
      assert.strictEqual(result.userAgent, message.userAgent);
      assert.deepEqual(result.profileKey, message.profileKey);
      assert.strictEqual(result.readReceipts, message.readReceipts);
      assert.deepEqual(result.masterKey, message.masterKey);
      assert.strictEqual(result.accountEntropyPool, message.accountEntropyPool);

      assert.deepEqual(
        toAciObject(result.aci).getRawUuidBytes(),
        message.aciBinary
      );

      strictAssert(result.pni, 'PNI should be provided');
      assert.deepEqual(
        toPniObject(result.pni).getRawUuidBytes(),
        message.pniBinary
      );
      assert.isTrue(result.pni.startsWith('PNI:'));
    });

    it('a message for an account without a phone number', () => {
      const authCredentialSalt = getRandomBytes(16);
      const message = buildProvisionMessage({
        number: null,
        pni: null,
        pniBinary: null,
        pniIdentityKeyPublic: null,
        pniIdentityKeyPrivate: null,
        authCredentialSalt,
      });

      const { secondary, envelope } = provision(message);
      const result = secondary.decrypt(envelope);

      assert.isUndefined(result.number);
      assert.isUndefined(result.pni);
      assert.isUndefined(result.pniKeyPair);
      assert.deepEqual(result.authCredentialSalt, authCredentialSalt);
    });

    it('backups data for link-and-sync', () => {
      const ephemeralBackupKey = getRandomBytes(32);
      const mediaRootBackupKey = getRandomBytes(32);
      const message = buildProvisionMessage({
        ephemeralBackupKey,
        mediaRootBackupKey,
      });

      const { secondary, envelope } = provision(message);
      const result = secondary.decrypt(envelope);

      assert.deepEqual(result.ephemeralBackupKey, ephemeralBackupKey);
      assert.deepEqual(result.mediaRootBackupKey, mediaRootBackupKey);
    });

    it('and leaves backups data undefined when not transferring', () => {
      const message = buildProvisionMessage({
        ephemeralBackupKey: null,
        mediaRootBackupKey: null,
      });

      const { secondary, envelope } = provision(message);
      const result = secondary.decrypt(envelope);

      assert.isUndefined(result.ephemeralBackupKey);
      assert.isUndefined(result.mediaRootBackupKey);
    });

    it('a legacy untagged pni string', () => {
      const pni = generatePni();
      const message = buildProvisionMessage({
        pni: toUntaggedPni(pni),
        pniBinary: null,
      });

      const { secondary, envelope } = provision(message);
      const result = secondary.decrypt(envelope);

      assert.strictEqual(result.pni, pni);
    });
  });

  describe('rejects', () => {
    it('a mac computed without the version byte', () => {
      const secondary = new ProvisioningCipher();
      const envelope = encodeAndDecodeProto(
        encryptWithMacMissingVersionByte(
          buildProvisionMessage(),
          secondary.getPublicKey()
        )
      );

      assert.throws(() => secondary.decrypt(envelope), 'Bad MAC');
    });

    it('a tampered ciphertext', () => {
      const { secondary, envelope } = provision(buildProvisionMessage());
      const { body } = envelope;
      strictAssert(body, 'expected a body');

      // Flip a bit in the middle of the ciphertext.
      const tampered = new Uint8Array(body);
      const target = 1 + IV_LENGTH;
      // oxlint-disable-next-line typescript/no-non-null-assertion operator-assignment no-bitwise
      tampered[target] = tampered[target]! ^ 0x01;

      assert.throws(
        () => secondary.decrypt({ ...envelope, body: tampered }),
        'Bad MAC'
      );
    });

    it('a tampered mac', () => {
      const { secondary, envelope } = provision(buildProvisionMessage());
      const { body } = envelope;
      strictAssert(body, 'expected a body');

      const tampered = new Uint8Array(body);
      const target = tampered.byteLength - 1;
      // oxlint-disable-next-line typescript/no-non-null-assertion operator-assignment no-bitwise
      tampered[target] = tampered[target]! ^ 0x01;

      assert.throws(
        () => secondary.decrypt({ ...envelope, body: tampered }),
        'Bad MAC'
      );
    });

    it('an unexpected version byte', () => {
      const { secondary, envelope } = provision(buildProvisionMessage());
      const { body } = envelope;
      strictAssert(body, 'expected a body');

      const tampered = new Uint8Array(body);
      tampered[0] = 2;

      assert.throws(
        () => secondary.decrypt({ ...envelope, body: tampered }),
        'Bad version number'
      );
    });

    it('an envelope sealed to a different device', () => {
      const message = buildProvisionMessage();

      const otherSecondary = new ProvisioningCipher();
      const primary = new ProvisioningCipher();
      const primaryPublicKey = primary.getPublicKey();
      const body = primary.encrypt(message, otherSecondary.getPublicKey());

      const secondary = new ProvisioningCipher();
      secondary.getPublicKey();

      const envelope = encodeAndDecodeProto({
        $unknown: [],
        publicKey: primaryPublicKey.serialize(),
        body,
      });

      assert.throws(() => secondary.decrypt(envelope), 'Bad MAC');
    });

    it('an envelope with no body', () => {
      const secondary = new ProvisioningCipher();

      assert.throws(
        () =>
          secondary.decrypt({
            $unknown: [],
            publicKey: new ProvisioningCipher().getPublicKey().serialize(),
            body: null,
          }),
        'Missing body'
      );
    });

    it('an envelope with no publicKey', () => {
      const { secondary, envelope } = provision(buildProvisionMessage());

      assert.throws(
        () => secondary.decrypt({ ...envelope, publicKey: null }),
        'Missing publicKey'
      );
    });
  });
});
