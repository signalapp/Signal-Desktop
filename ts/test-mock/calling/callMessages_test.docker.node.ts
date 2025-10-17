// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import createDebug from 'debug';
import { execFile } from 'node:child_process';
import { StorageState } from '@signalapp/mock-server';
import { expect } from 'playwright/test';
import type { Page } from 'playwright';
import { promisify } from 'node:util';
import * as durations from '../../util/durations/index.std.js';
import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import { runTurnInContainer, tearDownTurnContainer } from './helpers.node.js';

const FIXTURES = join(__dirname, '..', '..', '..', 'fixtures');
const VIRTUAL_AUDIO = join(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  '.bin',
  'virtual_audio'
);

const debug = createDebug('mock:test:calling:messages');
const execFilePromise = promisify(execFile);

describe('callMessages', function callMessages(this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap1: Bootstrap;
  let bootstrap2: Bootstrap;
  let app1: App;
  let app2: App;

  async function setUpAudio(source: string, sink: string) {
    debug(`setup source: ${source}, sink: ${sink}`);
    const args = ['--setup', '--input-source', source, '--output-sink', sink];
    try {
      const { stdout, stderr } = await execFilePromise(VIRTUAL_AUDIO, args, {
        timeout: 20000,
        encoding: 'utf8',
      });
      debug(stdout);
      debug(stderr);
    } catch (err) {
      debug(err);
      throw err;
    }
  }

  async function tearDownAudio(source: string, sink: string) {
    debug(`tear down source ${source}, sink: ${sink}`);
    await execFilePromise(VIRTUAL_AUDIO, [
      '--teardown',
      '--input-source',
      source,
      '--output-sink',
      sink,
    ]);
  }

  before(async () => {
    runTurnInContainer();
    // Set up two virtual sources and sinks.
    await setUpAudio('input_source_a', 'output_sink_a');
    await setUpAudio('input_source_b', 'output_sink_b');
  });

  after(async () => {
    tearDownTurnContainer();

    // Despite the API suggesting otherwise, we actually only need to call
    // `teardown` once: it will tear down **all** sources and sinks it has set
    // up, not just the ones passed here.
    await tearDownAudio('input_source_a', 'output_sink_a');
  });

  beforeEach(async () => {
    bootstrap1 = new Bootstrap();
    await bootstrap1.init();

    bootstrap2 = new Bootstrap({ server: bootstrap1.server });
    await bootstrap2.init();

    let state1 = StorageState.getEmpty();
    state1 = state1.updateAccount({
      profileKey: bootstrap1.phone.profileKey.serialize(),
    });

    state1 = state1.addContact(bootstrap2.phone, {
      whitelisted: true,
      profileKey: bootstrap2.phone.profileKey.serialize(),
      givenName: 'Contact2',
    });

    state1 = state1.pin(bootstrap2.phone);

    await bootstrap1.phone.setStorageState(state1);

    app1 = await bootstrap1.link();

    let state2 = StorageState.getEmpty();
    state2 = state2.updateAccount({
      profileKey: bootstrap2.phone.profileKey.serialize(),
    });

    state2 = state2.addContact(bootstrap1.phone, {
      whitelisted: true,
      profileKey: bootstrap1.phone.profileKey.serialize(),
      givenName: 'Contact1',
    });

    state2 = state2.pin(bootstrap1.phone);
    await bootstrap2.phone.setStorageState(state2);

    app2 = await bootstrap2.link();

    await app1.enableMedia();
    await app2.enableMedia();
  });

  afterEach(async function after(this: Mocha.Context) {
    if (!bootstrap1) {
      return;
    }
    await bootstrap1.maybeSaveLogs(this.currentTest, app1);
    await bootstrap2.maybeSaveLogs(this.currentTest, app2);

    await app2.close();
    await app1.close();

    await bootstrap2.teardown();
    await bootstrap1.teardown();
  });

  // Start an audio call with the given ACI.
  // Assumes that a conversation with them is visible in the left pane.
  async function startAudioCallWith(win: Page, aci: string) {
    const leftPane = win.locator('#LeftPane');

    await leftPane.locator(`[data-testid="${aci}"]`).click();
    // Try to start a call
    await win.locator('.module-ConversationHeader__button--audio').click();
    await win
      .locator('.CallingLobbyJoinButton')
      .and(win.locator('button:visible'))
      .click();
  }

  // Wait until the calling modal is not populated.
  async function awaitNoCall(win: Page) {
    await expect(win.locator('.module-calling__modal-container')).toBeEmpty();
  }

  async function setInputAndOutput(win: Page, input: string, output: string) {
    debug(`setInputAndOutput input: ${input} output: ${output}`);
    await win
      .locator('.CallSettingsButton__Button')
      .and(win.getByLabel('Settings'))
      .click();
    await win.locator('#audio-input').selectOption(input);
    await win.locator('#audio-output').selectOption(output);
    await win.locator('.module-calling-device-selection__close-button').click();
  }

  it('can call and decline a call', async () => {
    const window1 = await app1.getWindow();
    await startAudioCallWith(window1, bootstrap2.phone.device.aci);

    const window2 = await app2.getWindow();

    // Only wait for 3 seconds to make sure that this succeeded properly rather
    // than timing out after ~10 seconds and using a direct connection
    await window2
      .locator('.IncomingCallBar__button--decline')
      .click({ timeout: 3000 });

    await awaitNoCall(window1);
    await awaitNoCall(window2);
  });

  it('can call and accept a call', async () => {
    const theRaven = join(FIXTURES, 'the_raven.wav');

    const window1 = await app1.getWindow();
    await startAudioCallWith(window1, bootstrap2.phone.device.aci);

    const window2 = await app2.getWindow();

    // Only wait for 3 seconds to make sure that this succeeded properly rather
    // than timing out after ~10 seconds and using a direct connection
    await window2
      .locator('.IncomingCallBar__button--accept-audio')
      .click({ timeout: 3000 });

    try {
      await setInputAndOutput(window1, 'input_source_a', 'output_sink_a');

      await setInputAndOutput(window2, 'input_source_b', 'output_sink_b');

      execFile(
        VIRTUAL_AUDIO,
        [
          '--play',
          '--input-source',
          'input_source_a',
          '--output-sink',
          'output_sink_a',
          '--input-file',
          theRaven,
        ],
        (error, stdout, stderr) => {
          if (error) {
            throw error;
          }
          debug(stdout);
          debug(stderr);
        }
      );

      // Wait for audio levels indicator to be visible.
      await expect(
        window2.locator(
          '.module-ongoing-call__direct-call-speaking-indicator > .CallingAudioIndicator--with-content'
        )
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await bootstrap2.screenshotWindow(window2, 'callee');
      // hang up after we detect audio (or fail to)
      await window2.locator('.CallControls__JoinLeaveButton--hangup').click();

      await execFilePromise(VIRTUAL_AUDIO, [
        '--stop',
        '--input-source',
        'input_source_a',
        '--output-sink',
        'output_source_a',
      ]);

      await awaitNoCall(window1);
      await awaitNoCall(window2);

      await window2.locator('.NavTabs__Item--Settings').click();
      await window2.locator('.Preferences__button--calls').click();
      await bootstrap2.screenshotWindow(window2, 'callee');
    }
  });
});
