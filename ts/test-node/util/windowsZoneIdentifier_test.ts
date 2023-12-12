// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as Sinon from 'sinon';

import { writeWindowsZoneIdentifier } from '../../util/windowsZoneIdentifier';

describe('writeWindowsZoneIdentifier', () => {
  before(function (this: Mocha.Context) {
    if (process.platform !== 'win32') {
      this.skip();
    }
  });

  beforeEach(async function (this: Mocha.Context) {
    this.sandbox = Sinon.createSandbox();
    this.tmpdir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'signal-test-')
    );
  });

  afterEach(async function (this: Mocha.Context) {
    this.sandbox.restore();
    await fse.remove(this.tmpdir);
  });

  it('writes zone transfer ID 3 (internet) to the Zone.Identifier file', async function (this: Mocha.Context) {
    const file = path.join(this.tmpdir, 'file.txt');
    await fse.outputFile(file, 'hello');

    await writeWindowsZoneIdentifier(file);

    assert.strictEqual(
      await fs.promises.readFile(`${file}:Zone.Identifier`, 'utf8'),
      '[ZoneTransfer]\r\nZoneId=3'
    );
  });

  it('fails if there is an existing Zone.Identifier file', async function (this: Mocha.Context) {
    const file = path.join(this.tmpdir, 'file.txt');
    await fse.outputFile(file, 'hello');
    await fs.promises.writeFile(`${file}:Zone.Identifier`, '# already here');

    await assert.isRejected(writeWindowsZoneIdentifier(file));
  });

  it('fails if the original file does not exist', async function (this: Mocha.Context) {
    const file = path.join(this.tmpdir, 'file-never-created.txt');

    await assert.isRejected(writeWindowsZoneIdentifier(file));
  });

  it('fails if not on Windows', async function (this: Mocha.Context) {
    this.sandbox.stub(process, 'platform').get(() => 'darwin');

    const file = path.join(this.tmpdir, 'file.txt');
    await fse.outputFile(file, 'hello');

    await assert.isRejected(writeWindowsZoneIdentifier(file));
  });
});
