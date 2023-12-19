// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { vi, describe, it, assert } from 'vitest';
import { webcrypto } from 'node:crypto';

import { Provisioning } from './provisioning';

vi.stubGlobal('crypto', webcrypto);

describe.concurrent('provisioning', () => {
  it('should encrypt/decrypt the message', async () => {
    const us = await Provisioning.create();
    const them = await Provisioning.create();

    const message = {
      username: 'signal',
      password: 'whisper',
    };

    const encrypted = await them.encryptMessage(message, us.publicKey);
    const decrypted = await us.decryptMessage(encrypted);

    assert.deepStrictEqual(decrypted, message);
  });
});
