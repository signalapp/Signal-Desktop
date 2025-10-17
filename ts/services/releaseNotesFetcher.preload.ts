// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';
import lodash from 'lodash';

import * as durations from '../util/durations/index.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import * as Registration from '../util/registration.preload.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { drop } from '../util/drop.std.js';
import {
  writeNewAttachmentData,
  processNewAttachment,
} from '../util/migrations.preload.js';
import { strictAssert } from '../util/assert.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { incrementMessageCounter } from '../util/incrementMessageCounter.preload.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { saveNewMessageBatcher } from '../util/messageBatcher.preload.js';
import { generateMessageId } from '../util/generateMessageId.node.js';
import type { RawBodyRange } from '../types/BodyRange.std.js';
import { BodyRange } from '../types/BodyRange.std.js';
import type {
  ReleaseNotesManifestResponseType,
  ReleaseNoteResponseType,
  isOnline as doIsOnline,
  getReleaseNote as doGetReleaseNote,
  getReleaseNoteHash as doGetReleaseNoteHash,
  getReleaseNoteImageAttachment as doGetReleaseNoteImageAttachment,
  getReleaseNotesManifest as doGetReleaseNotesManifest,
  getReleaseNotesManifestHash as doGetReleaseNotesManifestHash,
} from '../textsecure/WebAPI.preload.js';
import type { WithRequiredProperties } from '../types/Util.std.js';
import { MessageModel } from '../models/messages.preload.js';
import { stringToMIMEType } from '../types/MIME.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { last } = lodash;

const log = createLogger('releaseNotesFetcher');

const FETCH_INTERVAL = 3 * durations.DAY;
const ERROR_RETRY_DELAY = 3 * durations.HOUR;
const NEXT_FETCH_TIME_STORAGE_KEY = 'releaseNotesNextFetchTime';
const PREVIOUS_MANIFEST_HASH_STORAGE_KEY = 'releaseNotesPreviousManifestHash';
const VERSION_WATERMARK_STORAGE_KEY = 'releaseNotesVersionWatermark';

type MinimalEventsType = {
  on(event: 'timetravel', callback: () => void): void;
};

type FetchOptions = {
  isNewVersion?: boolean;
};

type ManifestReleaseNoteType = WithRequiredProperties<
  ReleaseNotesManifestResponseType['announcements'][0],
  'desktopMinVersion'
>;

export type ReleaseNoteType = ReleaseNoteResponseType &
  Pick<ReleaseNotesManifestResponseType['announcements'][0], 'ctaId' | 'link'>;

const STYLE_MAPPING: Record<string, BodyRange.Style> = {
  bold: BodyRange.Style.BOLD,
  italic: BodyRange.Style.ITALIC,
  strikethrough: BodyRange.Style.STRIKETHROUGH,
  spoiler: BodyRange.Style.SPOILER,
  mono: BodyRange.Style.MONOSPACE,
};

export type ServerType = Readonly<{
  isOnline: typeof doIsOnline;
  getReleaseNote: typeof doGetReleaseNote;
  getReleaseNoteHash: typeof doGetReleaseNoteHash;
  getReleaseNoteImageAttachment: typeof doGetReleaseNoteImageAttachment;
  getReleaseNotesManifest: typeof doGetReleaseNotesManifest;
  getReleaseNotesManifestHash: typeof doGetReleaseNotesManifestHash;
}>;

export class ReleaseNotesFetcher {
  static initComplete = false;
  #timeout: NodeJS.Timeout | undefined;
  #isRunning = false;
  #server: ServerType;

  constructor(server: ServerType) {
    this.#server = server;
  }

  protected setTimeoutForNextRun(options?: FetchOptions): void {
    const now = Date.now();
    const time = itemStorage.get(NEXT_FETCH_TIME_STORAGE_KEY, now);

    log.info('Next update scheduled for', new Date(time).toISOString());

    let waitTime = time - now;
    if (waitTime < 0) {
      waitTime = 0;
    }

    clearTimeoutIfNecessary(this.#timeout);
    this.#timeout = setTimeout(() => this.#runWhenOnline(options), waitTime);
  }

  #getOrInitializeVersionWatermark(): string {
    const versionWatermark = itemStorage.get(VERSION_WATERMARK_STORAGE_KEY);
    if (versionWatermark) {
      return versionWatermark;
    }

    log.info('Initializing version high watermark to current version');
    const currentVersion = window.getVersion();
    drop(itemStorage.put(VERSION_WATERMARK_STORAGE_KEY, currentVersion));
    return currentVersion;
  }

  async #getReleaseNote(
    note: ManifestReleaseNoteType
  ): Promise<ReleaseNoteType | undefined> {
    const { uuid, ctaId, link } = note;
    const globalLocale = new Intl.Locale(window.SignalContext.getI18nLocale());
    const localesToTry = [
      globalLocale.toString(),
      globalLocale.language.toString(),
      'en',
    ].map(locale => locale.toLocaleLowerCase().replace('-', '_'));

    for (const localeToTry of localesToTry) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const hash = await this.#server.getReleaseNoteHash({
          uuid,
          locale: localeToTry,
        });

        if (hash === undefined) {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await this.#server.getReleaseNote({
          uuid,
          locale: localeToTry,
        });

        strictAssert(
          result.uuid === uuid,
          'UUID of localized release note should match requested UUID'
        );

        return {
          ...result,
          uuid,
          ctaId,
          link,
        };
      } catch {
        // If either request fails, try the next locale
        continue;
      }
    }

    throw new Error(
      `Could not fetch release note with any locale for UUID ${uuid}`
    );
  }

  async #processReleaseNotes(
    notes: ReadonlyArray<ManifestReleaseNoteType>
  ): Promise<void> {
    log.info('Ensuring Signal conversation');
    const signalConversation =
      await window.ConversationController.getOrCreateSignalConversation();

    const sortedNotes = [...notes].sort(
      (a: ManifestReleaseNoteType, b: ManifestReleaseNoteType) =>
        semver.compare(a.desktopMinVersion, b.desktopMinVersion)
    );

    const newestNote = last(sortedNotes);
    strictAssert(newestNote, 'processReleaseNotes requires at least 1 note');

    const versionWatermark = newestNote.desktopMinVersion;

    if (signalConversation.isBlocked()) {
      log.info(
        `Signal conversation is blocked, updating watermark to ${versionWatermark}`
      );
      drop(itemStorage.put(VERSION_WATERMARK_STORAGE_KEY, versionWatermark));
      return;
    }

    const hydratedNotesWithRawAttachments = (
      await Promise.all(
        sortedNotes.map(async note => {
          if (!note) {
            return null;
          }

          const hydratedNote = await this.#getReleaseNote(note);
          if (!hydratedNote) {
            return null;
          }
          if (hydratedNote.media) {
            const { imageData: rawAttachmentData, contentType } =
              await this.#server.getReleaseNoteImageAttachment(
                hydratedNote.media
              );

            return {
              hydratedNote,
              rawAttachmentData,
              contentType: hydratedNote.mediaContentType ?? contentType,
            };
          }

          return { hydratedNote, rawAttachmentData: null, contentType: null };
        })
      )
    ).filter(isNotNil);

    const hydratedNotes = await Promise.all(
      hydratedNotesWithRawAttachments.map(
        async ({ hydratedNote, rawAttachmentData, contentType }) => {
          if (rawAttachmentData && !contentType) {
            throw new Error('Content type is missing from attachment');
          }

          if (!rawAttachmentData || !contentType) {
            return { hydratedNote, processedAttachment: null };
          }

          const localAttachment =
            await writeNewAttachmentData(rawAttachmentData);

          const processedAttachment = await processNewAttachment(
            {
              ...localAttachment,
              contentType: stringToMIMEType(contentType),
            },
            'attachment'
          );

          return { hydratedNote, processedAttachment };
        }
      )
    );

    if (!hydratedNotes.length) {
      log.warn('No hydrated notes available, stopping');
      return;
    }

    const messages: Array<MessageAttributesType> = [];
    hydratedNotes.forEach(
      ({ hydratedNote: note, processedAttachment }, index) => {
        if (!note) {
          return;
        }

        const { title, body, bodyRanges: noteBodyRanges } = note;
        const titleBodySeparator = '\n\n';
        const filteredNoteBodyRanges: Array<RawBodyRange> = (
          noteBodyRanges ?? []
        )
          .map(range => {
            if (
              range.length == null ||
              range.start == null ||
              range.style == null ||
              !STYLE_MAPPING[range.style] ||
              range.start + range.length - 1 >= body.length
            ) {
              return null;
            }

            const relativeStart =
              range.start + title.length + titleBodySeparator.length;

            return {
              start: relativeStart,
              length: range.length,
              style: STYLE_MAPPING[range.style],
            };
          })
          .filter(isNotNil);

        const messageBody = `${title}${titleBodySeparator}${body}`;
        const bodyRanges: Array<RawBodyRange> = [
          { start: 0, length: title.length, style: BodyRange.Style.BOLD },
          ...filteredNoteBodyRanges,
        ];
        const timestamp = Date.now() + index;

        const message = new MessageModel({
          ...generateMessageId(incrementMessageCounter()),
          ...(processedAttachment
            ? { attachments: [processedAttachment] }
            : {}),
          body: messageBody,
          bodyRanges,
          conversationId: signalConversation.id,
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          received_at_ms: timestamp,
          sent_at: timestamp,
          serverTimestamp: timestamp,
          sourceDevice: 1,
          sourceServiceId: signalConversation.getServiceId(),
          timestamp,
          type: 'incoming',
        });

        window.MessageCache.register(message);
        drop(signalConversation.onNewMessage(message));
        messages.push(message.attributes);
      }
    );

    await Promise.all(
      messages.map(message => saveNewMessageBatcher.add(message))
    );

    signalConversation.set({ active_at: Date.now(), isArchived: false });
    signalConversation.throttledUpdateUnread();

    log.info(`Updating version watermark to ${versionWatermark}`);
    drop(itemStorage.put(VERSION_WATERMARK_STORAGE_KEY, versionWatermark));
  }

  async #scheduleForNextRun(options?: {
    isNewVersion?: boolean;
  }): Promise<void> {
    const now = Date.now();
    const nextTime = options?.isNewVersion ? now : now + FETCH_INTERVAL;
    await itemStorage.put(NEXT_FETCH_TIME_STORAGE_KEY, nextTime);
  }

  async #run(options?: FetchOptions): Promise<void> {
    if (this.#isRunning) {
      log.warn('Already running, preventing reentrancy');
      return;
    }

    this.#isRunning = true;
    log.info('Starting');
    try {
      const versionWatermark = this.#getOrInitializeVersionWatermark();
      log.info(`Version watermark is ${versionWatermark}`);

      const hash = await this.#server.getReleaseNotesManifestHash();
      if (!hash) {
        throw new Error('Release notes manifest hash missing');
      }

      const previousHash = itemStorage.get(PREVIOUS_MANIFEST_HASH_STORAGE_KEY);

      if (hash !== previousHash || options?.isNewVersion) {
        log.info(
          `Fetching manifest, isNewVersion=${
            options?.isNewVersion ? 'true' : 'false'
          }, hashChanged=${hash !== previousHash ? 'true' : 'false'}`
        );
        const manifest = await this.#server.getReleaseNotesManifest();
        const currentVersion = window.getVersion();
        const validNotes = manifest.announcements.filter(
          (note): note is ManifestReleaseNoteType =>
            note.desktopMinVersion != null &&
            semver.gt(note.desktopMinVersion, versionWatermark) &&
            semver.lte(note.desktopMinVersion, currentVersion)
        );
        if (validNotes.length) {
          log.info(`Processing ${validNotes.length} new release notes`);
          await this.#processReleaseNotes(validNotes);
        } else {
          log.info('No new release notes');
        }

        drop(itemStorage.put(PREVIOUS_MANIFEST_HASH_STORAGE_KEY, hash));
      } else {
        log.info('Manifest hash unchanged, aborting fetch');
      }

      await this.#scheduleForNextRun();
      this.setTimeoutForNextRun();
      window.SignalCI?.handleEvent('release_notes_fetcher_complete', {});
    } catch (error) {
      const errorString =
        error instanceof HTTPError
          ? error.code.toString()
          : Errors.toLogFormat(error);
      log.error(`Error, trying again later. ${errorString}`);
      setTimeout(() => this.setTimeoutForNextRun(), ERROR_RETRY_DELAY);
    } finally {
      this.#isRunning = false;
    }
  }

  #runWhenOnline(options?: FetchOptions) {
    if (this.#server.isOnline()) {
      drop(this.#run(options));
    } else {
      log.info('We are offline; will fetch when we are next online');
      const listener = () => {
        window.Whisper.events.off('online', listener);
        this.setTimeoutForNextRun(options);
      };
      window.Whisper.events.on('online', listener);
    }
  }

  public static async init(
    server: ServerType,
    events: MinimalEventsType,
    isNewVersion: boolean
  ): Promise<void> {
    if (ReleaseNotesFetcher.initComplete) {
      return;
    }

    ReleaseNotesFetcher.initComplete = true;

    const listener = new ReleaseNotesFetcher(server);

    if (isNewVersion) {
      await listener.#scheduleForNextRun({ isNewVersion });
    }
    listener.setTimeoutForNextRun({ isNewVersion });

    events.on('timetravel', () => {
      if (Registration.isDone()) {
        listener.setTimeoutForNextRun();
      }
    });
  }
}
