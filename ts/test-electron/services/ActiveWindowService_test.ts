// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

import { getActiveWindowService } from '../../services/ActiveWindowService';

describe('ActiveWindowService', () => {
  const fakeIpcEvent = {};

  beforeEach(function (this: Mocha.Context) {
    this.clock = sinon.useFakeTimers({ now: 1000 });
  });

  afterEach(function (this: Mocha.Context) {
    this.clock.restore();
  });

  function createFakeDocument() {
    return document.createElement('div');
  }

  it('is inactive at the start', () => {
    const service = getActiveWindowService(
      createFakeDocument(),
      new EventEmitter()
    );

    assert.isFalse(service.isActive());
  });

  it('becomes active after focusing', () => {
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(createFakeDocument(), fakeIpc);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    assert.isTrue(service.isActive());
  });

  it('becomes inactive after 15 seconds without interaction', function (this: Mocha.Context) {
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(createFakeDocument(), fakeIpc);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    this.clock.tick(5000);
    assert.isTrue(service.isActive());

    this.clock.tick(9999);
    assert.isTrue(service.isActive());

    this.clock.tick(1);
    assert.isFalse(service.isActive());
  });

  ['click', 'keydown', 'mousedown', 'mousemove', 'touchstart', 'wheel'].forEach(
    (eventName: string) => {
      it(`is inactive even in the face of ${eventName} events if unfocused`, function (this: Mocha.Context) {
        const fakeDocument = createFakeDocument();
        const fakeIpc = new EventEmitter();
        const service = getActiveWindowService(fakeDocument, fakeIpc);

        fakeIpc.emit('set-window-focus', fakeIpcEvent, false);

        fakeDocument.dispatchEvent(new Event(eventName));
        assert.isFalse(service.isActive());
      });

      it(`stays active if focused and receiving ${eventName} events`, function (this: Mocha.Context) {
        const fakeDocument = createFakeDocument();
        const fakeIpc = new EventEmitter();
        const service = getActiveWindowService(fakeDocument, fakeIpc);

        fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

        fakeDocument.dispatchEvent(new Event(eventName));
        assert.isTrue(service.isActive());

        this.clock.tick(8000);
        fakeDocument.dispatchEvent(new Event(eventName));
        assert.isTrue(service.isActive());

        this.clock.tick(8000);
        fakeDocument.dispatchEvent(new Event(eventName));
        assert.isTrue(service.isActive());
      });
    }
  );

  it('calls callbacks when going from unfocused to focused', () => {
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(createFakeDocument(), fakeIpc);

    const callback = sinon.stub();
    service.registerForActive(callback);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    sinon.assert.calledOnce(callback);
  });

  it('calls callbacks when receiving a click event after being focused', function (this: Mocha.Context) {
    const fakeDocument = createFakeDocument();
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(fakeDocument, fakeIpc);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    this.clock.tick(20000);

    const callback = sinon.stub();
    service.registerForActive(callback);

    fakeDocument.dispatchEvent(new Event('click'));

    sinon.assert.calledOnce(callback);
  });

  it('only calls callbacks every 5 seconds; it is throttled', function (this: Mocha.Context) {
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(createFakeDocument(), fakeIpc);

    const callback = sinon.stub();
    service.registerForActive(callback);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);
    fakeIpc.emit('set-window-focus', fakeIpcEvent, false);
    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);
    fakeIpc.emit('set-window-focus', fakeIpcEvent, false);
    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);
    fakeIpc.emit('set-window-focus', fakeIpcEvent, false);

    sinon.assert.calledOnce(callback);

    this.clock.tick(15000);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    sinon.assert.calledTwice(callback);
  });

  it('can remove callbacks', () => {
    const fakeDocument = createFakeDocument();
    const fakeIpc = new EventEmitter();
    const service = getActiveWindowService(fakeDocument, fakeIpc);

    const callback = sinon.stub();
    service.registerForActive(callback);
    service.unregisterForActive(callback);

    fakeIpc.emit('set-window-focus', fakeIpcEvent, true);

    sinon.assert.notCalled(callback);
  });
});
