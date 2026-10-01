// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { expect } from 'playwright/test';
import { StorageState } from '@signalapp/mock-server';
import {
  AccountEntropyPool,
  SvrKey,
} from '@signalapp/libsignal-client/dist/AccountKeys';

import type { PrimaryDevice } from '@signalapp/mock-server';

import { Bootstrap } from '../bootstrap.node.ts';
import { DAY, MINUTE } from '../../util/durations/index.std.ts';
import {
  clearVerificationCode,
  typeIntoInput,
  typeVerificationCode,
} from '../helpers.node.ts';
import { assert } from 'chai';
import { isNotEmpty, toHex } from '../../Bytes.std.ts';
import { deriveStorageServiceKey, getRandomBytes } from '../../Crypto.node.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';

import type { App } from '../playwright.node.ts';

export const debug = createDebug('mock:test:standalone:registration');

describe('standalone/registration', function (this: Mocha.Suite) {
  let bootstrap: Bootstrap;
  let app: App;

  this.timeout(MINUTE);
  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init({ isStandalone: true });

    app = await bootstrap.prepareForStandaloneRegistration();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should create new account, creating a new PIN with SVR2', async () => {
    const { server } = bootstrap;

    const window = await app.getWindow();

    debug('Set next ACI, verify nothing in in storage service');

    server.setNextAci(undefined);
    const aci = await server.generateAci();
    server.setNextAci(aci);

    const beforeManifest = server.getStorageManifest(aci);
    assert.isUndefined(beforeManifest, 'beforeManifest');

    {
      debug('PHONE_NUMBER: Enter phone number');
      const phoneInput = window.getByPlaceholder('Phone number');
      await typeIntoInput(phoneInput, '+14155551111', '');
      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('PHONE_NUMBER: Confirm phone number');
      const dialogText = window.getByText(
        'Is your phone number above correct?'
      );
      await expect(dialogText).toBeVisible();

      await window.getByRole('button', { name: 'Yes' }).click();
    }

    {
      debug('CAPTCHA: kick off validation');
      await window.getByRole('button', { name: 'Verify in Browser' }).click();
    }

    {
      debug('CAPTCHA: complete validation');
      const { seq, reason } = await app.waitForChallenge();
      assert.strictEqual(reason, 'standalone registration');

      await app.solveChallenge({ seq, data: { captcha: 'unused' } });
    }

    {
      debug('VERIFICATION_CODE: enter incorrect code');
      await typeVerificationCode(window, '123456');

      await window.getByRole('button', { name: 'Continue' }).click();

      // Dismiss the dialog that comes up
      await window.getByRole('button', { name: 'OK' }).click();
    }

    {
      debug('VERIFICATION_CODE: enter correct code');
      await clearVerificationCode(window);
      await typeVerificationCode(window, '111111');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    debug(
      'VERIFICATION_CODE: verify that first storage service manifest is uploaded'
    );

    const { version, storageKey, recordIkm } =
      await app.waitForUploadManifest();

    assert.strictEqual(version, 0, 'uploadManifest: first');

    const firstState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
    });

    assert.strictEqual(firstState.version, 0n, 'first state from server');

    {
      debug('PROFILE_ENTRY: enter first name');
      const firstNameInput = window.getByPlaceholder('First name (required)');
      await typeIntoInput(firstNameInput, 'John', '');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    const PIN = '876543';

    {
      debug('CREATE_PIN: enter pin');
      const phoneInput = window.getByPlaceholder('Create your PIN');
      await typeIntoInput(phoneInput, PIN, '');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('CREATE_PIN_CONFIRM: enter pin again');
      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await typeIntoInput(phoneInput, PIN, '');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('COMPLETE: Verify data was stored in SVR');
      const storedData = await app.waitForSVRStore();
      assert.strictEqual(
        storedData?.pin,
        PIN,
        'checking what was stored in SVR'
      );
    }

    {
      debug('COMPLETE: verify welcome screen');
      await expect(window.getByText('Welcome to Signal')).toBeVisible();
    }

    debug('COMPLETE: verify that storage service is updated with profile');

    const lastState = await server.waitForStorageState({
      aci,
      storageKey,
      recordIkm,
      after: firstState,
    });

    assert.strictEqual(lastState.version, 1n, 'last state from server');
  });

  [true, false].forEach((withRecordIkm: boolean) => {
    const text = withRecordIkm ? 'with recordIkm' : 'WITHOUT recordIkm';

    it(`should reregister account, verifying PIN with SVR2, ${text}`, async () => {
      const window = await app.getWindow();
      const { server, contacts } = bootstrap;

      debug('Put data into storage service before registration');

      server.setNextAci(undefined);
      const aci = await server.generateAci();
      server.setNextAci(aci);

      const originalAep = AccountEntropyPool.generate();
      const originalMasterKey = AccountEntropyPool.deriveSvrKey(originalAep);
      const originalStorageKey = deriveStorageServiceKey(originalMasterKey);
      const originalRecordIkm = getRandomBytes(32);

      const beforeManifest = server.getStorageManifest(aci);
      assert.isUndefined(beforeManifest, 'beforeManifest');

      let originalState = StorageState.getEmpty();

      for (const contact of contacts) {
        originalState = originalState.addContact(contact, {
          identityState: Proto.ContactRecord.IdentityState.VERIFIED,
          whitelisted: true,

          identityKey: contact.publicKey.serialize(),
          profileKey: contact.profileKey.serialize(),
          givenName: contact.profileName,
        });
      }

      const [firstContact] = contacts as [PrimaryDevice];
      originalState = originalState.pin(firstContact);

      await server.setStorageState({
        aci,
        state: originalState,
        storageKey: Buffer.from(originalStorageKey),
        recordIkm: withRecordIkm ? Buffer.from(originalRecordIkm) : undefined,
      });

      {
        debug('PHONE_NUMBER: Enter phone number');
        const phoneInput = window.getByPlaceholder('Phone number');
        await typeIntoInput(phoneInput, '+14155551111', '');
        await window.getByRole('button', { name: 'Continue' }).click();
      }

      {
        debug('PHONE_NUMBER: Confirm phone number');
        const dialogText = window.getByText(
          'Is your phone number above correct?'
        );
        await expect(dialogText).toBeVisible();

        await window.getByRole('button', { name: 'Yes' }).click();
      }

      {
        debug('CAPTCHA: kick off validation');
        await window.getByRole('button', { name: 'Verify in Browser' }).click();
      }

      {
        debug('CAPTCHA: complete validation');
        const { seq, reason } = await app.waitForChallenge();
        assert.strictEqual(reason, 'standalone registration');

        await app.solveChallenge({ seq, data: { captcha: 'unused' } });
      }

      {
        debug('VERIFICATION_CODE: enter code');
        await typeVerificationCode(window, '111111');

        await window.getByRole('button', { name: 'Continue' }).click();
      }

      {
        debug('PROFILE_ENTRY: enter first name');
        const firstNameInput = window.getByPlaceholder('First name (required)');
        await typeIntoInput(firstNameInput, 'John', '');

        await window.getByRole('button', { name: 'Continue' }).click();
      }

      {
        debug('VERIFY_PIN: enter incorrect PIN');

        const INCORRECT_PIN = '123456';

        const phoneInput = window.getByPlaceholder('Enter your PIN');
        await typeIntoInput(phoneInput, INCORRECT_PIN, '');

        await app.saveSVR2RestoreResponse({
          success: false,
          error: 'pin-incorrect',
          triesRemaining: 3,
        });

        await window.getByRole('button', { name: 'Continue' }).click();
      }

      {
        debug('VERIFY_PIN: dismiss dialog');
        await expect(
          window.getByText('You have 3 attempts remaining')
        ).toBeVisible();

        await window.getByRole('button', { name: 'OK' }).click();
      }

      const CORRECT_PIN = '876543';
      {
        debug('VERIFY_PIN: enter correct PIN');

        const DATA = originalMasterKey;

        const phoneInput = window.getByPlaceholder('Enter your PIN');

        await phoneInput.clear();
        await typeIntoInput(phoneInput, CORRECT_PIN, '');

        await app.saveSVR2RestoreResponse({
          success: true,
          // @ts-expect-error We need to get this data through JSON
          data: toHex(DATA),
          triesRemaining: 3,
        });

        await window.getByRole('button', { name: 'Continue' }).click();
      }

      {
        debug('COMPLETE: verify welcome screen');
        await expect(window.getByText('Welcome to Signal')).toBeVisible();
      }

      {
        debug(
          'COMPLETE: verify that we pull pinned contact down from storage service'
        );

        const leftPane = window.locator('#LeftPane');
        await leftPane
          .locator(`[data-testid="${firstContact.device.aci}"]`)
          .waitFor();
      }

      let newStorageKey: Buffer<ArrayBuffer> | undefined;
      {
        debug(
          'COMPLETE: verify that we re-uploaded manifest encrypted with new storageKey'
        );

        const expectedVersion = 2;
        const { version, storageKey, recordIkm } =
          await app.waitForUploadManifest(BigInt(expectedVersion));

        assert.notDeepEqual(
          storageKey,
          Buffer.from(originalStorageKey),
          'storageKey should not match'
        );
        if (withRecordIkm) {
          assert.deepEqual(
            recordIkm,
            Buffer.from(originalRecordIkm),
            'recordIkm should match'
          );
        } else {
          assert.isTrue(isNotEmpty(recordIkm), 'recordIkm should exist');
        }
        assert.strictEqual(
          version,
          expectedVersion,
          'first manifest was v1, now we are at v2'
        );

        newStorageKey = storageKey;

        const secondState = await server.waitForStorageState({
          aci,
          storageKey,
          recordIkm,
          predicate: state => {
            return state.version === BigInt(expectedVersion);
          },
        });
        assert.strictEqual(secondState.version, 2n, 'second state from server');

        assert.isEmpty(
          server.getOrphanedStorageKeys({ aci, storageKey, recordIkm })
        );
      }

      {
        debug('COMPLETE: Verify new data was stored back to SVR');

        const storedData = await app.waitForSVRStore();
        assert.strictEqual(
          storedData?.pin,
          CORRECT_PIN,
          'checking what was stored in SVR'
        );

        const newMasterKey = storedData.data;
        const derivedStorageKey = deriveStorageServiceKey(newMasterKey);
        assert.deepEqual(derivedStorageKey, newStorageKey);
        assert.notDeepEqual(newMasterKey, originalMasterKey);
      }
    });
  });

  it('should reregister account with reglock enabled, verifying PIN with SVR2', async () => {
    const window = await app.getWindow();

    debug('Put data into storage service before registration');

    const { server, contacts } = bootstrap;

    server.setNextAci(undefined);
    const aci = await server.generateAci();
    server.setNextAci(aci);

    debug(`aci is: ${aci}`);

    const originalAep = AccountEntropyPool.generate();
    const originalMasterKey = AccountEntropyPool.deriveSvrKey(originalAep);
    const originalStorageKey = deriveStorageServiceKey(originalMasterKey);
    const originalRecordIkm = getRandomBytes(32);

    const originalSvrKey = new SvrKey(originalMasterKey);
    const originalRegistrationLockData =
      originalSvrKey.deriveRegistrationLock();
    const originalRegistrationLockToken = toHex(originalRegistrationLockData);

    server.setRegistrationLockToken(aci, originalRegistrationLockToken);

    const beforeManifest = server.getStorageManifest(aci);
    assert.isUndefined(beforeManifest, 'beforeManifest');

    let originalState = StorageState.getEmpty();

    for (const contact of contacts) {
      originalState = originalState.addContact(contact, {
        identityState: Proto.ContactRecord.IdentityState.VERIFIED,
        whitelisted: true,

        identityKey: contact.publicKey.serialize(),
        profileKey: contact.profileKey.serialize(),
        givenName: contact.profileName,
      });
    }

    const [firstContact] = contacts as [PrimaryDevice];
    originalState = originalState.pin(firstContact);

    await server.setStorageState({
      aci,
      state: originalState,
      storageKey: Buffer.from(originalStorageKey),
      recordIkm: Buffer.from(originalRecordIkm),
    });

    {
      debug('PHONE_NUMBER: Enter phone number');
      const phoneInput = window.getByPlaceholder('Phone number');
      await typeIntoInput(phoneInput, '+14155551111', '');
      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('PHONE_NUMBER: Confirm phone number');
      const dialogText = window.getByText(
        'Is your phone number above correct?'
      );
      await expect(dialogText).toBeVisible();

      await window.getByRole('button', { name: 'Yes' }).click();
    }

    {
      debug('CAPTCHA: kick off validation');
      await window.getByRole('button', { name: 'Verify in Browser' }).click();
    }

    {
      debug('CAPTCHA: complete validation');
      const { seq, reason } = await app.waitForChallenge();
      assert.strictEqual(reason, 'standalone registration');

      await app.solveChallenge({ seq, data: { captcha: 'unused' } });
    }

    {
      debug('VERIFICATION_CODE: enter code');
      await typeVerificationCode(window, '111111');

      // Server will automatically return 423; we don't provide registrationLock token

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('PROFILE_ENTRY: enter first name');
      const firstNameInput = window.getByPlaceholder('First name (required)');
      await typeIntoInput(firstNameInput, 'John', '');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('VERIFY_PIN: enter incorrect PIN');

      const INCORRECT_PIN = '123456';

      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await typeIntoInput(phoneInput, INCORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: false,
        error: 'pin-incorrect',
        triesRemaining: 5,
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('VERIFY_PIN: dismiss dialog');
      await expect(
        window.getByText('You have 5 attempts remaining')
      ).toBeVisible();

      await window.getByRole('button', { name: 'OK' }).click();
    }

    const CORRECT_PIN = '876543';

    server.setNextAci(aci);

    {
      debug('VERIFY_PIN: enter correct PIN');

      const phoneInput = window.getByPlaceholder('Enter your PIN');

      await phoneInput.clear();
      await typeIntoInput(phoneInput, CORRECT_PIN, '');

      server.setRegisterResponseError(undefined);
      await app.saveSVR2RestoreResponse({
        success: true,
        // @ts-expect-error We need to get this data through JSON
        data: toHex(originalMasterKey),
        triesRemaining: 5,
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('COMPLETE: verify welcome screen');
      await expect(window.getByText('Welcome to Signal')).toBeVisible();
    }

    {
      debug(
        'COMPLETE: verify that we pull pinned contact down from storage service'
      );

      const leftPane = window.locator('#LeftPane');
      await leftPane
        .locator(`[data-testid="${firstContact.device.aci}"]`)
        .waitFor();
    }

    let newStorageKey: Buffer<ArrayBuffer> | undefined;
    {
      debug(
        'COMPLETE: verify that we re-uploaded manifest encrypted with new storageKey'
      );

      const expectedVersion = 3;
      const { version, storageKey, recordIkm } =
        await app.waitForUploadManifest(BigInt(expectedVersion));

      assert.notDeepEqual(
        storageKey,
        Buffer.from(originalStorageKey),
        'storageKey should not match old storage key'
      );
      assert.deepEqual(recordIkm, Buffer.from(originalRecordIkm));
      assert.strictEqual(version, expectedVersion);

      newStorageKey = storageKey;

      const secondState = await server.waitForStorageState({
        aci,
        storageKey,
        recordIkm,
        predicate: state => {
          return state.version === BigInt(expectedVersion);
        },
      });
      assert.strictEqual(
        secondState.version,
        BigInt(expectedVersion),
        'second state from server, properly decrypted!'
      );
    }

    {
      debug('COMPLETE: Verify new data was stored back to SVR');

      const storedData = await app.waitForSVRStore();
      assert.strictEqual(
        storedData?.pin,
        CORRECT_PIN,
        'checking what was stored in SVR'
      );

      const newMasterKey = storedData.data;
      const derivedStorageKey = deriveStorageServiceKey(newMasterKey);
      assert.deepEqual(derivedStorageKey, newStorageKey);
      assert.notDeepEqual(newMasterKey, originalMasterKey);

      const newSvrKey = new SvrKey(newMasterKey);
      const newRegistrationLockData = newSvrKey.deriveRegistrationLock();
      const newRegistrationLockToken = toHex(newRegistrationLockData);

      const actualRegistrationLockToken = server.getRegistrationLockToken(aci);
      assert.strictEqual(newRegistrationLockToken, actualRegistrationLockToken);
    }
  });

  it('should show account locked screen on failed PIN with reglock', async () => {
    const window = await app.getWindow();
    const { server } = bootstrap;

    {
      debug('PHONE_NUMBER: Enter phone number');
      const phoneInput = window.getByPlaceholder('Phone number');
      await typeIntoInput(phoneInput, '+14155551111', '');
      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('PHONE_NUMBER: Confirm phone number');
      const dialogText = window.getByText(
        'Is your phone number above correct?'
      );
      await expect(dialogText).toBeVisible();

      await window.getByRole('button', { name: 'Yes' }).click();
    }

    {
      debug('CAPTCHA: kick off validation');
      await window.getByRole('button', { name: 'Verify in Browser' }).click();
    }

    {
      debug('CAPTCHA: complete validation');
      const { seq, reason } = await app.waitForChallenge();
      assert.strictEqual(reason, 'standalone registration');

      await app.solveChallenge({ seq, data: { captcha: 'unused' } });
    }

    {
      debug('VERIFICATION_CODE: enter code');
      await typeVerificationCode(window, '111111');

      // Force server to return error telling us that reglock is active
      server.setRegisterResponseError({
        code: 423,
        data: {
          timeRemaining: 5 * DAY,
          svr2Credentials: { username: 'fake423', password: 'fake423' },
        },
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('PROFILE_ENTRY: enter first name');
      const firstNameInput = window.getByPlaceholder('First name (required)');
      await typeIntoInput(firstNameInput, 'John', '');

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('VERIFY_PIN: enter incorrect PIN #1');

      const INCORRECT_PIN = '123456';

      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await typeIntoInput(phoneInput, INCORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: false,
        error: 'pin-incorrect',
        triesRemaining: 3,
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('VERIFY_PIN: dismiss dialog');
      await expect(
        window.getByText('You have 3 attempts remaining')
      ).toBeVisible();

      await window.getByRole('button', { name: 'OK' }).click();
    }

    {
      debug('VERIFY_PIN: enter incorrect PIN #2');

      const INCORRECT_PIN = '223456';

      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await phoneInput.clear();
      await typeIntoInput(phoneInput, INCORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: false,
        error: 'pin-incorrect',
        triesRemaining: 2,
      });

      await window.getByRole('button', { name: 'Continue' }).click();

      await expect(window.getByText('2 attempts remaining')).toBeVisible();
    }

    {
      debug('VERIFY_PIN: enter incorrect PIN #3');

      const INCORRECT_PIN = '334567';

      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await phoneInput.clear();
      await typeIntoInput(phoneInput, INCORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: false,
        error: 'pin-incorrect',
        triesRemaining: 1,
      });

      await window.getByRole('button', { name: 'Continue' }).click();

      await expect(window.getByText('1 attempt remaining')).toBeVisible();
    }

    {
      debug('VERIFY_PIN: enter incorrect PIN #4');

      const INCORRECT_PIN = '434567';

      const phoneInput = window.getByPlaceholder('Enter your PIN');
      await phoneInput.clear();
      await typeIntoInput(phoneInput, INCORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: false,
        error: 'pin-incorrect',
        triesRemaining: 0,
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('ACCOUNT_LOCKED: verify text');
      await expect(
        window.getByText('Your account has been locked')
      ).toBeVisible();

      await window
        .getByRole('button', { name: 'Use a different number' })
        .click();
    }

    {
      debug('PHONE_NUMBER: verify wait time');
      await expect(window.getByText('Enter your phone number')).toBeVisible();
      await expect(window.getByText('Please try again in')).toBeVisible();
    }
  });
});
