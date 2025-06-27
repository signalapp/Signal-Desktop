// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

import { ReleaseNotesFetcher } from '../../services/releaseNotesFetcher';
import * as durations from '../../util/durations';
import { generateAci } from '../../types/ServiceId';
import { saveNewMessageBatcher } from '../../util/messageBatcher';
import type { WebAPIType } from '../../textsecure/WebAPI';
import type { CIType } from '../../CI';
import type { ConversationModel } from '../../models/conversations';
import { strictAssert } from '../../util/assert';

const waitUntil = (
  condition: () => boolean,
  timeoutMs = 5000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const intervalMs = 10;

    const intervalId = setInterval(() => {
      if (condition()) {
        clearInterval(intervalId);
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(intervalId);
        reject(new Error('waitUntil timeout'));
      }
    }, intervalMs);
  });
};

describe('ReleaseNotesFetcher', () => {
  const NEXT_FETCH_TIME_STORAGE_KEY = 'releaseNotesNextFetchTime';
  const PREVIOUS_MANIFEST_HASH_STORAGE_KEY = 'releaseNotesPreviousManifestHash';
  const VERSION_WATERMARK_STORAGE_KEY = 'releaseNotesVersionWatermark';
  const FETCH_INTERVAL = 3 * durations.DAY;

  type TestSetupOptions = {
    // Storage values
    storedVersionWatermark?: string;
    storedPreviousManifestHash?: string;
    storedNextFetchTime?: number;

    // Version configuration
    currentVersion?: string;
    noteVersion?: string;
    isNewVersion?: boolean;

    // Server responses
    isOnline?: boolean;
    manifestHash?: string;
    manifestAnnouncements?: Array<{
      uuid: string;
      desktopMinVersion: string;
      ctaId: string;
      link: string;
    }>;
    releaseNote?: {
      uuid: string;
      title: string;
      body: string;
      bodyRanges: Array<{ start: number; length: number; style: string }>;
    };

    // Conversation behavior
    conversationIsBlocked?: boolean;

    // Timing
    now?: number;
  };

  let sandbox = sinon.createSandbox();
  let clock: sinon.SinonFakeTimers | undefined;
  let originalTextsecureServer: WebAPIType | undefined;
  let originalSignalCI: CIType | undefined;

  async function setupTest(options: TestSetupOptions = {}) {
    sandbox = sinon.createSandbox();

    // Reset conversation controller for clean state
    window.ConversationController.reset();
    await window.ConversationController.load();

    const {
      storedVersionWatermark = '1.36.0',
      storedPreviousManifestHash,
      storedNextFetchTime,
      currentVersion = '1.36.0',
      noteVersion = '1.37.0',
      isNewVersion = false,
      isOnline = true,
      manifestHash = 'abc123',
      manifestAnnouncements,
      releaseNote,
      conversationIsBlocked = false,
      now = 1621500000000,
    } = options;

    clock = sinon.useFakeTimers({ now });

    const events = new EventEmitter();
    const fakeNoteUuid = uuid();

    let savedClockTime = now;

    // Timer utilities
    const pauseFakeTimer = () => {
      if (clock) {
        savedClockTime = clock.now;
        clock.restore();
        clock = undefined;
      }
    };

    const resumeFakeTimer = () => {
      if (!clock) {
        clock = sinon.useFakeTimers({ now: savedClockTime });
      }
    };

    // Create fake conversation
    const fakeConversation = {
      isBlocked: sandbox.stub().returns(conversationIsBlocked),
      onNewMessage: sandbox.stub().resolves(),
      getServiceId: sandbox.stub().returns(generateAci()),
      set: sandbox.stub(),
      throttledUpdateUnread: sandbox.stub(),
      id: 'fake-signal-conversation-id',
    };

    // Stub global methods
    sandbox
      .stub(window.ConversationController, 'getOrCreateSignalConversation')
      .resolves(fakeConversation as unknown as ConversationModel);

    sandbox.stub(window.MessageCache, 'register').callsFake(message => message);

    // Save original values before modifying
    originalTextsecureServer = window.textsecure.server;
    originalSignalCI = window.SignalCI;

    // Initialize textsecure.server if needed
    if (!window.textsecure.server) {
      window.textsecure.server = {} as unknown as WebAPIType;
    }

    // Stub server methods
    const serverStubs = {
      isOnline: sandbox.stub().returns(isOnline),
      getReleaseNotesManifestHash: sandbox.stub().resolves(manifestHash),
      getReleaseNotesManifest: sandbox.stub().resolves({
        announcements: manifestAnnouncements || [
          {
            uuid: fakeNoteUuid,
            desktopMinVersion: noteVersion,
            ctaId: 'test-cta',
            link: 'https://signal.org',
          },
        ],
      }),
      getReleaseNoteHash: sandbox.stub().resolves('note-hash-1'),
      getReleaseNote: sandbox.stub().resolves(
        releaseNote || {
          uuid: fakeNoteUuid,
          title: 'New Release',
          body: 'This is the body text of the release note',
          bodyRanges: [{ start: 0, length: 4, style: 'bold' }],
        }
      ),
      getReleaseNoteImageAttachment: sandbox.stub().resolves({
        imageData: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
      }),
    };

    sandbox.stub(window.textsecure, 'server').value(serverStubs);

    // Stub other globals
    sandbox.stub(window.SignalContext, 'getI18nLocale').returns('en-US');
    sandbox.stub(window, 'getVersion').returns(currentVersion);

    sandbox.stub(window.Signal, 'Migrations').value({
      writeNewAttachmentData: sandbox
        .stub()
        .resolves({ path: 'path/to/attachment' }),
      processNewAttachment: sandbox.stub().resolves({
        path: 'processed/path',
        contentType: 'image/png',
        size: 123,
      }),
    });

    // Mock Whisper events
    const fakeWhisperEvents = new EventEmitter();
    sandbox.stub(window.Whisper, 'events').value(fakeWhisperEvents);

    // Mock saveNewMessageBatcher
    sandbox.stub(saveNewMessageBatcher, 'add').resolves();

    // Mock SignalCI
    window.SignalCI =
      window.SignalCI ||
      ({
        handleEvent: sandbox.stub(),
      } as unknown as CIType);

    // Helper to run fetcher and wait for completion
    const runFetcherAndWaitForCompletion = async () => {
      resumeFakeTimer();
      await ReleaseNotesFetcher.init(events, isNewVersion);

      strictAssert(
        clock,
        'fake timer should be initialized to start release notes fetcher'
      );
      // Fast-forward to trigger the run
      await clock.nextAsync();

      pauseFakeTimer();
      // Wait for SignalCI.handleEvent to be called
      const signalCI = window.SignalCI as unknown as {
        handleEvent: sinon.SinonStub;
      };
      await waitUntil(() => signalCI.handleEvent.called, 1000);
      resumeFakeTimer();
    };

    // Storage setup helper
    const setupStorage = async () => {
      // Set up storage values
      await window.storage.put('chromiumRegistrationDone', '');

      if (storedVersionWatermark !== undefined) {
        await window.textsecure.storage.put(
          VERSION_WATERMARK_STORAGE_KEY,
          storedVersionWatermark
        );
      } else {
        await window.textsecure.storage.remove(VERSION_WATERMARK_STORAGE_KEY);
      }

      if (storedPreviousManifestHash !== undefined) {
        await window.textsecure.storage.put(
          PREVIOUS_MANIFEST_HASH_STORAGE_KEY,
          storedPreviousManifestHash
        );
      } else {
        await window.textsecure.storage.remove(
          PREVIOUS_MANIFEST_HASH_STORAGE_KEY
        );
      }

      if (storedNextFetchTime !== undefined) {
        await window.textsecure.storage.put(
          NEXT_FETCH_TIME_STORAGE_KEY,
          storedNextFetchTime
        );
      } else {
        await window.textsecure.storage.remove(NEXT_FETCH_TIME_STORAGE_KEY);
      }
    };

    // Helper functions to get current storage values
    const getCurrentHash = () => {
      return window.textsecure.storage.get(PREVIOUS_MANIFEST_HASH_STORAGE_KEY);
    };

    const getCurrentWatermark = () => {
      return window.textsecure.storage.get(VERSION_WATERMARK_STORAGE_KEY);
    };

    return {
      // Core objects
      sandbox,
      clock,
      events,
      fakeConversation,
      serverStubs,

      // Constants
      NEXT_FETCH_TIME_STORAGE_KEY,
      PREVIOUS_MANIFEST_HASH_STORAGE_KEY,
      VERSION_WATERMARK_STORAGE_KEY,
      FETCH_INTERVAL,

      // Test data
      fakeNoteUuid,
      now,

      // Helper functions
      pauseFakeTimer,
      resumeFakeTimer,
      runFetcherAndWaitForCompletion,
      setupStorage,
      getCurrentHash,
      getCurrentWatermark,
    };
  }

  afterEach(async () => {
    // Reset static state
    ReleaseNotesFetcher.initComplete = false;

    // Restore all stubs and timers
    sandbox.restore();
    clock?.restore();

    // Restore original global values (even if they were undefined)
    window.textsecure.server = originalTextsecureServer as WebAPIType;
    window.SignalCI = originalSignalCI as CIType;

    // Reset storage state
    await window.storage.fetch();

    // Reset conversation controller for next test
    window.ConversationController.reset();
  });

  describe('#run', () => {
    it('initializes version watermark if not set', async () => {
      const {
        setupStorage,
        runFetcherAndWaitForCompletion,
        getCurrentWatermark,
      } = await setupTest({
        storedVersionWatermark: undefined,
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      const storedWatermark = getCurrentWatermark();

      assert.strictEqual(storedWatermark, '1.36.0');
    });

    it('fetches manifest when hash changes', async () => {
      const {
        setupStorage,
        runFetcherAndWaitForCompletion,
        serverStubs,
        getCurrentHash,
      } = await setupTest({
        storedPreviousManifestHash: 'old-hash',
        manifestHash: 'new-hash-123',
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      sinon.assert.calledOnce(serverStubs.getReleaseNotesManifest);

      assert.strictEqual(getCurrentHash(), 'new-hash-123');
    });

    it('does not fetch when hash is the same', async () => {
      const {
        setupStorage,
        runFetcherAndWaitForCompletion,
        serverStubs,
        getCurrentHash,
      } = await setupTest({
        storedPreviousManifestHash: 'hash',
        manifestHash: 'hash',
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      sinon.assert.notCalled(serverStubs.getReleaseNotesManifest);

      assert.strictEqual(getCurrentHash(), 'hash');
    });

    // Flaky in CI, TODO(yash): DESKTOP-8877
    it.skip('forces a manifest fetch for a new version', async () => {
      const {
        setupStorage,
        runFetcherAndWaitForCompletion,
        serverStubs,
        getCurrentHash,
      } = await setupTest({
        storedPreviousManifestHash: 'hash',
        manifestHash: 'hash',
        isNewVersion: true,
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      sinon.assert.calledOnce(serverStubs.getReleaseNotesManifest);

      assert.strictEqual(getCurrentHash(), 'hash');
    });

    it('processes release notes when valid notes are found and updates watermark', async () => {
      const {
        setupStorage,
        runFetcherAndWaitForCompletion,
        serverStubs,
        getCurrentWatermark,
      } = await setupTest({
        storedPreviousManifestHash: 'old-hash',
        manifestHash: 'new-hash-123',
        currentVersion: 'v1.37.0',
        noteVersion: 'v1.37.0',
        storedVersionWatermark: 'v1.36.0',
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      sinon.assert.calledOnce(serverStubs.getReleaseNotesManifest);
      sinon.assert.calledOnce(serverStubs.getReleaseNote);
      sinon.assert.called(window.MessageCache.register as sinon.SinonStub);

      assert.strictEqual(getCurrentWatermark(), 'v1.37.0');
    });
  });
});
