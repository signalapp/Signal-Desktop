// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import type { PowerSaveBlocker } from 'electron';

import { PreventDisplaySleepService } from '../../../app/PreventDisplaySleepService';

describe('PreventDisplaySleepService', () => {
  class FakePowerSaveBlocker implements PowerSaveBlocker {
    #nextId = 0;
    #idsStarted = new Set<number>();

    isStarted(id: number): boolean {
      return this.#idsStarted.has(id);
    }

    start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number {
      assert.strictEqual(type, 'prevent-display-sleep');

      const result = this.#nextId;
      this.#nextId += 1;
      this.#idsStarted.add(result);
      return result;
    }

    stop(id: number): boolean {
      assert(this.#idsStarted.has(id), `${id} was never started`);
      this.#idsStarted.delete(id);
      return false;
    }

    // This is only for testing.
    _idCount(): number {
      return this.#idsStarted.size;
    }
  }

  let sandbox: sinon.SinonSandbox;
  let powerSaveBlocker: FakePowerSaveBlocker;
  let service: PreventDisplaySleepService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    powerSaveBlocker = new FakePowerSaveBlocker();
    service = new PreventDisplaySleepService(powerSaveBlocker);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does nothing if disabling when it was already disabled', () => {
    const startStub = sandbox.stub(powerSaveBlocker, 'start');
    const stopStub = sandbox.stub(powerSaveBlocker, 'stop');

    service.setEnabled(false);

    assert.strictEqual(powerSaveBlocker._idCount(), 0);
    sinon.assert.notCalled(startStub);
    sinon.assert.notCalled(stopStub);
  });

  it('can start power blocking', () => {
    service.setEnabled(true);

    assert.strictEqual(powerSaveBlocker._idCount(), 1);
  });

  it('only starts power blocking once', () => {
    service.setEnabled(true);
    service.setEnabled(true);
    service.setEnabled(true);

    assert.strictEqual(powerSaveBlocker._idCount(), 1);
  });

  it('can start and stop power blocking', () => {
    const startSpy = sandbox.spy(powerSaveBlocker, 'start');
    const stopStub = sandbox.spy(powerSaveBlocker, 'stop');

    service.setEnabled(true);
    service.setEnabled(false);

    assert.strictEqual(powerSaveBlocker._idCount(), 0);
    sinon.assert.calledOnce(startSpy);
    sinon.assert.calledOnce(stopStub);
  });

  it('can toggle power blocking several times', () => {
    const startSpy = sandbox.spy(powerSaveBlocker, 'start');
    const stopStub = sandbox.spy(powerSaveBlocker, 'stop');

    service.setEnabled(true);
    service.setEnabled(false);
    service.setEnabled(true);
    service.setEnabled(false);
    service.setEnabled(true);

    assert.strictEqual(powerSaveBlocker._idCount(), 1);
    sinon.assert.calledThrice(startSpy);
    sinon.assert.calledTwice(stopStub);
  });
});
