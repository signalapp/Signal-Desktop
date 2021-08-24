// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { MainSQL } from '../../sql/main';
import { SystemTraySetting } from '../../types/SystemTraySetting';

import { SystemTraySettingCache } from '../../../app/SystemTraySettingCache';

describe('SystemTraySettingCache', () => {
  let sandbox: sinon.SinonSandbox;

  let sqlCallStub: sinon.SinonStub;
  let sql: Pick<MainSQL, 'sqlCall'>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sqlCallStub = sandbox.stub().resolves();
    sql = { sqlCall: sqlCallStub };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns MinimizeToAndStartInSystemTray if passed the --start-in-tray argument', async () => {
    const justOneArg = new SystemTraySettingCache(
      sql,
      ['--start-in-tray'],
      '1.2.3'
    );
    assert.strictEqual(
      await justOneArg.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    const bothArgs = new SystemTraySettingCache(
      sql,
      ['--start-in-tray', '--use-tray-icon'],
      '1.2.3'
    );
    assert.strictEqual(
      await bothArgs.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    sinon.assert.notCalled(sqlCallStub);
  });

  it('returns MinimizeToSystemTray if passed the --use-tray-icon argument', async () => {
    const cache = new SystemTraySettingCache(sql, ['--use-tray-icon'], '1.2.3');
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );

    sinon.assert.notCalled(sqlCallStub);
  });

  it('returns DoNotUseSystemTray if system tray is supported but no preference is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    const cache = new SystemTraySettingCache(sql, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);
  });

  it('returns DoNotUseSystemTray if system tray is supported but the stored preference is invalid', async () => {
    sandbox.stub(process, 'platform').value('win32');

    sqlCallStub.resolves({ value: 'garbage' });

    const cache = new SystemTraySettingCache(sql, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);
  });

  it('returns the stored preference if system tray is supported and something is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    sqlCallStub.resolves({ value: 'MinimizeToSystemTray' });

    const cache = new SystemTraySettingCache(sql, [], '1.2.3');
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );
  });

  it('only kicks off one request to the database if multiple sources ask at once', async () => {
    sandbox.stub(process, 'platform').value('win32');

    const cache = new SystemTraySettingCache(sql, [], '1.2.3');

    await Promise.all([cache.get(), cache.get(), cache.get()]);

    sinon.assert.calledOnce(sqlCallStub);
  });

  it('returns DoNotUseSystemTray if system tray is unsupported and there are no CLI flags', async () => {
    sandbox.stub(process, 'platform').value('darwin');

    const cache = new SystemTraySettingCache(sql, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);

    sinon.assert.notCalled(sqlCallStub);
  });
});
