// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { Sound, SoundType } from '../../util/Sound.std.ts';
import { explodePromise } from '../../util/explodePromise.std.ts';

class FakeSource extends globalThis.EventTarget {
  buffer?: AudioBuffer;
  loop = false;
  connect = sinon.stub();
  disconnect = sinon.stub();
  start = sinon.stub();
  stop = sinon.stub();

  end(): void {
    this.dispatchEvent(new globalThis.Event('ended'));
  }
}

describe('Sound', () => {
  const sandbox = sinon.createSandbox();
  let sources: Array<FakeSource>;
  let context: {
    createBufferSource: sinon.SinonStub;
    createGain: sinon.SinonStub;
    decodeAudioData: sinon.SinonStub;
    resume: sinon.SinonStub;
    suspend: sinon.SinonStub;
    destination: object;
    currentTime: number;
  };
  let load: sinon.SinonStub;

  beforeEach(() => {
    sources = [];
    context = {
      createBufferSource: sandbox.stub().callsFake(() => {
        const source = new FakeSource();
        sources.push(source);
        return source;
      }),
      createGain: sandbox.stub().callsFake(() => ({
        connect: sandbox.stub(),
        disconnect: sandbox.stub(),
        gain: { setValueAtTime: sandbox.stub() },
      })),
      decodeAudioData: sandbox.stub().resolves({}),
      resume: sandbox.stub().resolves(),
      suspend: sandbox.stub().resolves(),
      destination: {},
      currentTime: 0,
    };
    sandbox
      .stub(Sound as unknown as { context?: AudioContext }, 'context')
      .value(undefined);
    sandbox.define(globalThis, 'AudioContext', sandbox.stub().returns(context));
    load = sandbox.stub(Sound, 'loadSoundFile').resolves(new ArrayBuffer(0));
    Sound.sounds.clear();
  });

  afterEach(() => {
    for (const source of sources) {
      source.end();
    }
    Sound.sounds.clear();
    sandbox.restore();
  });

  function getSource(index: number): FakeSource {
    const source = sources[index];
    assert.isDefined(source);
    return source;
  }

  function makeSound(loop = false): Sound {
    return new Sound({ soundType: SoundType.Ringtone, loop });
  }

  it('suspends during decoding and resumes before starting playback', async () => {
    const decoded = explodePromise<AudioBuffer>();
    context.decodeAudioData.returns(decoded.promise);
    const playing = makeSound().play();
    await Promise.resolve();
    sinon.assert.calledOnce(context.suspend);
    sinon.assert.notCalled(context.resume);

    decoded.resolve({} as AudioBuffer);
    await playing;
    sinon.assert.callOrder(context.suspend, context.resume, getSource(0).start);
    getSource(0).end();
    sinon.assert.calledTwice(context.suspend);
  });

  it('keeps the context running until overlapping sounds have all ended', async () => {
    await makeSound().play();
    await makeSound().play();
    getSource(0).end();
    sinon.assert.calledOnce(context.suspend);
    getSource(1).end();
    sinon.assert.calledTwice(context.suspend);
    sinon.assert.calledOnce(getSource(0).disconnect);
    sinon.assert.calledOnce(getSource(1).disconnect);
  });

  it('suspends after a looping sound is stopped and can play it again', async () => {
    const sound = makeSound(true);
    await sound.play();
    assert.isTrue(getSource(0).loop);
    sound.stop();
    sinon.assert.calledOnce(getSource(0).stop);
    getSource(0).end();
    sinon.assert.calledTwice(context.suspend);

    await sound.play();
    sinon.assert.calledTwice(context.resume);
    sinon.assert.calledOnce(getSource(1).start);
    sinon.assert.calledOnce(load);
  });

  it('does not stop a source which has already ended', async () => {
    const sound = makeSound();
    await sound.play();
    getSource(0).end();
    sound.stop();
    sinon.assert.notCalled(getSource(0).stop);
  });

  it('cancels a looping sound stopped while loading', async () => {
    const loaded = explodePromise<ArrayBuffer>();
    load.returns(loaded.promise);
    const sound = makeSound(true);
    const playing = sound.play();
    sound.stop();
    loaded.resolve(new ArrayBuffer(0));
    await playing;
    assert.lengthOf(sources, 0);
    sinon.assert.calledOnce(context.suspend);
    sinon.assert.notCalled(context.resume);
  });

  it('cancels a looping sound stopped while resuming', async () => {
    const resumed = explodePromise<void>();
    context.resume.returns(resumed.promise);
    const sound = makeSound(true);
    const playing = sound.play();
    await Promise.resolve();
    await Promise.resolve();
    sinon.assert.calledOnce(context.resume);
    sound.stop();
    resumed.resolve(undefined);
    await playing;
    sinon.assert.notCalled(getSource(0).start);
    sinon.assert.calledTwice(context.suspend);
  });

  it('does not clear a newer source when an older playback ends', async () => {
    const sound = makeSound();
    await sound.play();
    await sound.play();
    getSource(0).end();
    sound.stop();
    sinon.assert.calledOnce(getSource(1).stop);
    sinon.assert.calledOnce(context.suspend);
    getSource(1).end();
    sinon.assert.calledTwice(context.suspend);
  });

  it('keeps the context suspended when decoding fails', async () => {
    context.decodeAudioData.rejects(new Error('decode failed'));
    await makeSound().play();
    sinon.assert.calledOnce(context.suspend);
    sinon.assert.notCalled(context.resume);
    assert.lengthOf(sources, 0);
  });

  it('releases a source if resuming fails', async () => {
    context.resume.rejects(new Error('resume failed'));
    try {
      await makeSound().play();
      assert.fail('Expected playback to reject');
    } catch (error) {
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'resume failed');
    }
    sinon.assert.notCalled(getSource(0).start);
    sinon.assert.calledOnce(getSource(0).disconnect);
    sinon.assert.calledTwice(context.suspend);
  });
});
