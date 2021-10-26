// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import type { MainSQL } from '../../sql/main';
import { SystemTraySetting } from '../../types/SystemTraySetting';

import type { ConfigType } from '../../../app/base_config';
import { SystemTraySettingCache } from '../../../app/SystemTraySettingCache';

describe('SystemTraySettingCache', () => {
  let sandbox: sinon.SinonSandbox;

  let sqlCallStub: sinon.SinonStub;
  let configGetStub: sinon.SinonStub;
  let configSetStub: sinon.SinonStub;
  let sql: Pick<MainSQL, 'sqlCall'>;
  let config: Pick<ConfigType, 'get' | 'set'>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sqlCallStub = sandbox.stub().resolves();
    sql = { sqlCall: sqlCallStub };

    configGetStub = sandbox.stub().returns(undefined);
    configSetStub = sandbox.stub().returns(undefined);
    config = { get: configGetStub, set: configSetStub };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns MinimizeToAndStartInSystemTray if passed the --start-in-tray argument', async () => {
    const justOneArg = new SystemTraySettingCache(
      sql,
      config,
      ['--start-in-tray'],
      '1.2.3'
    );
    assert.strictEqual(
      await justOneArg.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    const bothArgs = new SystemTraySettingCache(
      sql,
      config,
      ['--start-in-tray', '--use-tray-icon'],
      '1.2.3'
    );
    assert.strictEqual(
      await bothArgs.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    sinon.assert.notCalled(sqlCallStub);
    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
  });

  it('returns MinimizeToSystemTray if passed the --use-tray-icon argument', async () => {
    const cache = new SystemTraySettingCache(
      sql,
      config,
      ['--use-tray-icon'],
      '1.2.3'
    );
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );

    sinon.assert.notCalled(sqlCallStub);
    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
  });

  it('returns DoNotUseSystemTray if system tray is supported but no preference is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    assert(
      configSetStub.calledOnceWith(
        'system-tray-setting',
        SystemTraySetting.DoNotUseSystemTray
      )
    );
  });

  it('returns DoNotUseSystemTray if system tray is supported but the stored preference is invalid', async () => {
    sandbox.stub(process, 'platform').value('win32');

    sqlCallStub.resolves({ value: 'garbage' });

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    assert(
      configSetStub.calledOnceWith(
        'system-tray-setting',
        SystemTraySetting.DoNotUseSystemTray
      )
    );
  });

  it('returns the stored preference if system tray is supported and something is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    sqlCallStub.resolves({ value: 'MinimizeToSystemTray' });

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    assert(
      configSetStub.calledOnceWith(
        'system-tray-setting',
        SystemTraySetting.MinimizeToSystemTray
      )
    );
  });

  it('returns the cached preference if system tray is supported and something is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    configGetStub.returns('MinimizeToSystemTray');

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    sinon.assert.notCalled(sqlCallStub);
  });

  it('only kicks off one request to the database if multiple sources ask at once', async () => {
    sandbox.stub(process, 'platform').value('win32');

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');

    await Promise.all([cache.get(), cache.get(), cache.get()]);

    assert(configGetStub.calledOnceWith('system-tray-setting'));
    sinon.assert.calledOnce(sqlCallStub);
  });

  it('returns DoNotUseSystemTray if system tray is unsupported and there are no CLI flags', async () => {
    sandbox.stub(process, 'platform').value('darwin');

    const cache = new SystemTraySettingCache(sql, config, [], '1.2.3');
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);

    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
    sinon.assert.notCalled(sqlCallStub);
  });
});
