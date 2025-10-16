// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'node:events';
import { v4 as uuid } from 'uuid';

import { ReleaseNotesFetcher } from '../../services/releaseNotesFetcher.preload.js';
import * as durations from '../../util/durations/index.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { saveNewMessageBatcher } from '../../util/messageBatcher.preload.js';
import type { CIType } from '../../CI.preload.js';
import type { ConversationModel } from '../../models/conversations.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

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

    const events = new EventEmitter();
    const fakeNoteUuid = uuid();

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
    originalSignalCI = window.SignalCI;

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

    // Stub other globals
    sandbox.stub(window.SignalContext, 'getI18nLocale').returns('en-US');
    sandbox.stub(window, 'getVersion').returns(currentVersion);

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
      await ReleaseNotesFetcher.init(serverStubs, events, isNewVersion);

      // Wait for SignalCI.handleEvent to be called
      const signalCI = window.SignalCI as unknown as {
        handleEvent: sinon.SinonStub;
      };
      await waitUntil(() => signalCI.handleEvent.called, 1000);
    };

    // Storage setup helper
    const setupStorage = async () => {
      // Set up storage values
      await itemStorage.put('chromiumRegistrationDone', '');

      if (storedVersionWatermark !== undefined) {
        await itemStorage.put(
          VERSION_WATERMARK_STORAGE_KEY,
          storedVersionWatermark
        );
      } else {
        await itemStorage.remove(VERSION_WATERMARK_STORAGE_KEY);
      }

      if (storedPreviousManifestHash !== undefined) {
        await itemStorage.put(
          PREVIOUS_MANIFEST_HASH_STORAGE_KEY,
          storedPreviousManifestHash
        );
      } else {
        await itemStorage.remove(PREVIOUS_MANIFEST_HASH_STORAGE_KEY);
      }

      if (storedNextFetchTime !== undefined) {
        await itemStorage.put(NEXT_FETCH_TIME_STORAGE_KEY, storedNextFetchTime);
      } else {
        await itemStorage.remove(NEXT_FETCH_TIME_STORAGE_KEY);
      }
    };

    // Helper functions to get current storage values
    const getCurrentHash = () => {
      return itemStorage.get(PREVIOUS_MANIFEST_HASH_STORAGE_KEY);
    };

    const getCurrentWatermark = () => {
      return itemStorage.get(VERSION_WATERMARK_STORAGE_KEY);
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
    sandbox.reset();
    clock?.restore();

    // Restore original global values (even if they were undefined)
    window.SignalCI = originalSignalCI as CIType;

    // Reset storage state
    await itemStorage.fetch();

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
        isNewVersion: true,
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
        isNewVersion: true,
      });

      await setupStorage();
      await runFetcherAndWaitForCompletion();

      sinon.assert.calledOnce(serverStubs.getReleaseNotesManifest);

      assert.strictEqual(getCurrentHash(), 'new-hash-123');
    });

    // TODO(DESKTOP-9092): test setup requires isNewVersion=true, but
    // that flag forces a manifest fetch.
    it.skip('does not fetch when hash is the same', async () => {
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

      sinon.assert.notCalled(serverStubs.getReleaseNotesManifest);

      assert.strictEqual(getCurrentHash(), 'hash');
    });

    it('forces a manifest fetch for a new version', async () => {
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
        isNewVersion: true,
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
