// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import { expect } from 'playwright/test';

import type { App } from '../playwright.node.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { MINUTE } from '../../util/durations/index.std.ts';
import { typeIntoInput } from '../helpers.node.ts';
import { assert } from 'chai';
import { randomBytes } from 'node:crypto';

export const debug = createDebug('mock:test:registration');

describe('registration', function (this: Mocha.Suite) {
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
    const window = await app.getWindow();

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
      const CODE = '111111';
      for (let i = 0; i < CODE.length; i += 1) {
        const char = CODE[i];
        if (!char) {
          continue;
        }

        const codeInput = window.getByLabel(`Character ${i + 1} of 6`);
        // oxlint-disable-next-line no-await-in-loop
        await typeIntoInput(codeInput, char, '');
      }

      await window.getByRole('button', { name: 'Continue' }).click();
    }

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
      const storedData = await app.getSvr2StoreParameters();
      assert.strictEqual(storedData?.pin, PIN);
    }

    {
      debug('COMPLETE: verify welcome screen');
      await expect(window.getByText('Welcome to Signal')).toBeVisible();
    }
  });

  it('should reregister account, verifying PIN with SVR2', async () => {
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
      const CODE = '111111';
      for (let i = 0; i < CODE.length; i += 1) {
        const char = CODE[i];
        if (!char) {
          continue;
        }

        const codeInput = window.getByLabel(`Character ${i + 1} of 6`);
        // oxlint-disable-next-line no-await-in-loop
        await typeIntoInput(codeInput, char, '');
      }

      // Force server to return storageCapable: true
      server.setRegisterResponseData({ storageCapable: true });

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

    {
      debug('VERIFY_PIN: enter correct PIN');

      const CORRECT_PIN = '876543';
      const DATA = randomBytes(32);

      const phoneInput = window.getByPlaceholder('Enter your PIN');

      await phoneInput.clear();
      await typeIntoInput(phoneInput, CORRECT_PIN, '');

      await app.saveSVR2RestoreResponse({
        success: true,
        data: DATA,
        triesRemaining: 3,
      });

      await window.getByRole('button', { name: 'Continue' }).click();
    }

    {
      debug('COMPLETE: verify welcome screen');
      await expect(window.getByText('Welcome to Signal')).toBeVisible();
    }
  });
});
