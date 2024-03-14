// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { SystemTraySetting } from '../../types/SystemTraySetting';

import type { ConfigType } from '../../../app/base_config';
import { SystemTraySettingCache } from '../../../app/SystemTraySettingCache';

describe('SystemTraySettingCache', () => {
  let sandbox: sinon.SinonSandbox;

  let configGetStub: sinon.SinonStub;
  let configSetStub: sinon.SinonStub;
  let config: Pick<ConfigType, 'get' | 'set'>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    configGetStub = sandbox.stub().returns(undefined);
    configSetStub = sandbox.stub().returns(undefined);
    config = { get: configGetStub, set: configSetStub };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns MinimizeToAndStartInSystemTray if passed the --start-in-tray argument', async () => {
    const justOneArg = new SystemTraySettingCache(config, ['--start-in-tray']);
    assert.strictEqual(
      await justOneArg.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    const bothArgs = new SystemTraySettingCache(config, [
      '--start-in-tray',
      '--use-tray-icon',
    ]);
    assert.strictEqual(
      await bothArgs.get(),
      SystemTraySetting.MinimizeToAndStartInSystemTray
    );

    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
  });

  it('returns MinimizeToSystemTray if passed the --use-tray-icon argument', async () => {
    const cache = new SystemTraySettingCache(config, ['--use-tray-icon']);
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );

    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
  });

  it('returns Uninitialized if system tray is supported but no preference is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    const cache = new SystemTraySettingCache(config, []);
    assert.strictEqual(await cache.get(), SystemTraySetting.Uninitialized);
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    assert(
      configSetStub.calledOnceWith(
        'system-tray-setting',
        SystemTraySetting.Uninitialized
      )
    );
  });

  it('returns Uninitialized if system tray is supported but the stored preference is invalid', async () => {
    sandbox.stub(process, 'platform').value('win32');

    configGetStub.returns('garbage');

    const cache = new SystemTraySettingCache(config, []);
    assert.strictEqual(await cache.get(), SystemTraySetting.Uninitialized);
    assert(configGetStub.calledOnceWith('system-tray-setting'));
    assert(
      configSetStub.calledOnceWith(
        'system-tray-setting',
        SystemTraySetting.Uninitialized
      )
    );
  });

  it('returns the cached preference if system tray is supported and something is stored', async () => {
    sandbox.stub(process, 'platform').value('win32');

    configGetStub.returns('MinimizeToSystemTray');

    const cache = new SystemTraySettingCache(config, []);
    assert.strictEqual(
      await cache.get(),
      SystemTraySetting.MinimizeToSystemTray
    );
    assert(configGetStub.calledOnceWith('system-tray-setting'));
  });

  it('returns DoNotUseSystemTray if system tray is unsupported and there are no CLI flags', async () => {
    sandbox.stub(process, 'platform').value('darwin');

    const cache = new SystemTraySettingCache(config, []);
    assert.strictEqual(await cache.get(), SystemTraySetting.DoNotUseSystemTray);

    sinon.assert.notCalled(configGetStub);
    sinon.assert.notCalled(configSetStub);
  });
});
