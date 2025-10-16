// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { assert } from 'chai';
import fsExtra from 'fs-extra';

import {
  _getFileHash,
  getSignaturePath,
  loadHexFromPath,
  verifySignature,
  writeHexToPath,
  writeSignature,
} from '../../updater/signature.node.js';
import { createTempDir, deleteTempDir } from '../../updater/common.main.js';
import { keyPair } from '../../updater/curve.node.js';
import { createLogger } from '../../logging/log.std.js';

const { copy } = fsExtra;

const log = createLogger('signature_test');

describe('updater/signatures', () => {
  it('_getFileHash returns correct hash', async () => {
    const filePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
    const expected =
      '7bc77f27d92d00b4a1d57c480ca86dacc43d57bc318339c92119d1fbf6b557a5';

    const hash = await _getFileHash(filePath);

    assert.strictEqual(expected, Buffer.from(hash).toString('hex'));
  });

  it('roundtrips binary file writes', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const path = join(tempDir, 'something.bin');
      const { publicKey } = keyPair();

      await writeHexToPath(path, publicKey);

      const fromDisk = await loadHexFromPath(path);

      assert.strictEqual(
        Buffer.from(fromDisk).compare(Buffer.from(publicKey)),
        0
      );
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });

  it('roundtrips signature', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const version = 'v1.23.2';
      const sourcePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      const updatePath = join(tempDir, 'ghost-kitty.mp4');
      await copy(sourcePath, updatePath);

      const privateKeyPath = join(tempDir, 'private.key');
      const { publicKey, privateKey } = keyPair();
      await writeHexToPath(privateKeyPath, privateKey);

      const signature = await writeSignature(
        updatePath,
        version,
        privateKeyPath
      );

      const signaturePath = getSignaturePath(updatePath);
      assert.strictEqual(existsSync(signaturePath), true);

      const verified = await verifySignature(
        updatePath,
        version,
        signature,
        publicKey
      );
      assert.strictEqual(verified, true);
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });

  it('fails signature verification if version changes', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const version = 'v1.23.2';
      const brokenVersion = 'v1.23.3';

      const sourcePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      const updatePath = join(tempDir, 'ghost-kitty.mp4');
      await copy(sourcePath, updatePath);

      const privateKeyPath = join(tempDir, 'private.key');
      const { publicKey, privateKey } = keyPair();
      await writeHexToPath(privateKeyPath, privateKey);

      const signature = await writeSignature(
        updatePath,
        version,
        privateKeyPath
      );

      const verified = await verifySignature(
        updatePath,
        brokenVersion,
        signature,
        publicKey
      );
      assert.strictEqual(verified, false);
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });

  it('fails signature verification if signature tampered with', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const version = 'v1.23.2';

      const sourcePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      const updatePath = join(tempDir, 'ghost-kitty.mp4');
      await copy(sourcePath, updatePath);

      const privateKeyPath = join(tempDir, 'private.key');
      const { publicKey, privateKey } = keyPair();
      await writeHexToPath(privateKeyPath, privateKey);

      const signature = await writeSignature(
        updatePath,
        version,
        privateKeyPath
      );
      signature[4] += 3;

      const verified = await verifySignature(
        updatePath,
        version,
        signature,
        publicKey
      );
      assert.strictEqual(verified, false);
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });

  it('fails signature verification if binary file tampered with', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const version = 'v1.23.2';

      const sourcePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      const updatePath = join(tempDir, 'ghost-kitty.mp4');
      await copy(sourcePath, updatePath);

      const privateKeyPath = join(tempDir, 'private.key');
      const { publicKey, privateKey } = keyPair();
      await writeHexToPath(privateKeyPath, privateKey);

      const signature = await writeSignature(
        updatePath,
        version,
        privateKeyPath
      );

      const brokenSourcePath = join(
        __dirname,
        '../../../fixtures/pixabay-Soap-Bubble-7141.mp4'
      );
      await copy(brokenSourcePath, updatePath);

      const verified = await verifySignature(
        updatePath,
        version,
        signature,
        publicKey
      );
      assert.strictEqual(verified, false);
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });

  it('fails signature verification if signed by different key', async () => {
    let tempDir;

    try {
      tempDir = await createTempDir();

      const version = 'v1.23.2';

      const sourcePath = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      const updatePath = join(tempDir, 'ghost-kitty.mp4');
      await copy(sourcePath, updatePath);

      const privateKeyPath = join(tempDir, 'private.key');
      const { publicKey } = keyPair();
      const { privateKey } = keyPair();
      await writeHexToPath(privateKeyPath, privateKey);

      const signature = await writeSignature(
        updatePath,
        version,
        privateKeyPath
      );

      const verified = await verifySignature(
        updatePath,
        version,
        signature,
        publicKey
      );
      assert.strictEqual(verified, false);
    } finally {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    }
  });
});
