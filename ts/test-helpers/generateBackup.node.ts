// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { createCipheriv, randomBytes } from 'node:crypto';
import {
  AccountEntropyPool,
  BackupKey,
} from '@signalapp/libsignal-client/dist/AccountKeys.js';
import { MessageBackupKey } from '@signalapp/libsignal-client/dist/MessageBackup.js';

import type { AciString } from '../types/ServiceId.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import { CipherType } from '../types/Crypto.std.js';
import { appendPaddingStream } from '../util/logPadding.node.js';
import { prependStream } from '../util/prependStream.node.js';
import { appendMacStream } from '../util/appendMacStream.node.js';
import { toAciObject } from '../util/ServiceId.node.js';
import { encodeDelimited } from '../util/encodeDelimited.std.js';
import { BACKUP_VERSION } from '../services/backups/constants.std.js';
import { Backups } from '../protobuf/index.std.js';

export type BackupGeneratorConfigType = Readonly<
  {
    aci: AciString;
    profileKey: Uint8Array<ArrayBuffer>;
    conversations: number;
    conversationAcis?: ReadonlyArray<AciString>;
    messages: number;
    mediaRootBackupKey: Uint8Array<ArrayBuffer>;
  } & (
    | {
        accountEntropyPool: string;
      }
    | {
        backupKey: Uint8Array<ArrayBuffer>;
      }
  )
>;

const IV_LENGTH = 16;

export type GenerateBackupResultType = Readonly<{
  backupId: Uint8Array<ArrayBuffer>;
  stream: Readable;
}>;

export function generateBackup(
  options: BackupGeneratorConfigType
): GenerateBackupResultType {
  const { aci } = options;
  let backupKey: BackupKey;
  if ('accountEntropyPool' in options) {
    backupKey = AccountEntropyPool.deriveBackupKey(options.accountEntropyPool);
  } else {
    backupKey = new BackupKey(options.backupKey);
  }
  const aciObj = toAciObject(aci);
  const backupId = backupKey.deriveBackupId(aciObj);
  const { aesKey, hmacKey } = new MessageBackupKey({
    backupKey,
    backupId,
  });

  const iv = randomBytes(IV_LENGTH);

  const stream = Readable.from(createRecords(options))
    .pipe(createGzip())
    .pipe(appendPaddingStream())
    .pipe(createCipheriv(CipherType.AES256CBC, aesKey, iv))
    .pipe(prependStream(iv))
    .pipe(appendMacStream(hmacKey));

  return { backupId, stream };
}

function* frame(
  item: NonNullable<Backups.Frame.Params['item']>
): Iterable<Uint8Array<ArrayBuffer>> {
  yield* encodeDelimited(
    Backups.Frame.encode({
      item,
    })
  );
}

let now = Date.now();
function getTimestamp(): bigint {
  now += 1;
  return BigInt(now);
}

function* createRecords({
  profileKey,
  conversations,
  conversationAcis = [],
  messages,
  mediaRootBackupKey,
}: BackupGeneratorConfigType): Iterable<Uint8Array<ArrayBuffer>> {
  yield* encodeDelimited(
    Backups.BackupInfo.encode({
      version: BigInt(BACKUP_VERSION),
      backupTimeMs: getTimestamp(),
      mediaRootBackupKey,
      currentAppVersion: null,
      firstAppVersion: null,
      debugInfo: null,
    })
  );

  // Account data
  yield* frame({
    account: {
      profileKey,
      givenName: 'Backup',
      familyName: 'Benchmark',
      accountSettings: {
        readReceipts: false,
        sealedSenderIndicators: false,
        typingIndicators: false,
        linkPreviews: false,
        notDiscoverableByPhoneNumber: false,
        preferContactAvatars: false,
        universalExpireTimerSeconds: 0,
        preferredReactionEmoji: [],
        displayBadgesOnProfile: true,
        keepMutedChatsArchived: false,
        hasSetMyStoriesPrivacy: true,
        hasViewedOnboardingStory: true,
        storiesDisabled: false,
        hasSeenGroupStoryEducationSheet: true,
        hasCompletedUsernameOnboarding: true,
        hasSeenAdminDeleteEducationDialog: false,
        phoneNumberSharingMode:
          Backups.AccountData.PhoneNumberSharingMode.EVERYBODY,
        defaultChatStyle: {
          wallpaper: null,
          bubbleColor: {
            autoBubbleColor: {},
          },
          dimWallpaperInDarkMode: false,
        },
        customChatColors: [],
        storyViewReceiptsEnabled: null,
        optimizeOnDeviceStorage: null,
        backupTier: null,
        defaultSentMediaQuality: null,
        autoDownloadSettings: null,
        screenLockTimeoutMinutes: null,
        pinReminders: null,
        appTheme: null,
        callsUseLessDataSetting: null,
        allowSealedSenderFromAnyone: null,
        allowAutomaticKeyVerification: null,
      },
      username: null,
      usernameLink: null,
      avatarUrlPath: null,
      donationSubscriberData: null,
      backupsSubscriberData: null,
      svrPin: null,
      androidSpecificSettings: null,
      bioText: null,
      bioEmoji: null,
      keyTransparencyData: null,
    },
  });

  const selfId = 0n;

  yield* frame({
    recipient: {
      id: selfId,
      destination: {
        self: {
          avatarColor: null,
        },
      },
    },
  });

  const chats = new Array<{
    id: bigint;
    aci: Uint8Array<ArrayBuffer>;
  }>();

  for (let i = 1; i <= conversations; i += 1) {
    const id = BigInt(i);
    const chatAci = toAciObject(
      conversationAcis.at(i - 1) ?? generateAci()
    ).getRawUuidBytes();

    chats.push({
      id,
      aci: chatAci,
    });

    yield* frame({
      recipient: {
        id,
        destination: {
          contact: {
            aci: chatAci,
            blocked: false,
            visibility: Backups.Contact.Visibility.VISIBLE,
            registration: {
              registered: {},
            },
            profileKey: randomBytes(32),
            profileSharing: true,
            profileGivenName: `Contact ${i}`,
            profileFamilyName: 'Generated',
            hideStory: false,

            pni: null,
            username: null,
            e164: null,
            identityKey: null,
            identityState: null,
            nickname: null,
            note: null,
            systemGivenName: null,
            systemFamilyName: null,
            systemNickname: null,
            avatarColor: null,
            keyTransparencyData: null,
          },
        },
      },
    });

    yield* frame({
      chat: {
        id,
        recipientId: id,
        archived: false,
        pinnedOrder: 0,
        expirationTimerMs: 0n,
        muteUntilMs: 0n,
        markedUnread: false,
        dontNotifyForMentionsIfMuted: false,
        style: {
          wallpaper: null,
          bubbleColor: {
            autoBubbleColor: {},
          },
          dimWallpaperInDarkMode: false,
        },
        expireTimerVersion: 1,
      },
    });
  }

  for (let i = 0; i < messages; i += 1) {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const chat = chats[i % chats.length]!;

    const isIncoming = i % 2 === 0;

    const dateSent = getTimestamp();

    yield* frame({
      chatItem: {
        chatId: chat.id,
        authorId: isIncoming ? chat.id : selfId,
        dateSent,
        revisions: [],
        sms: false,
        expireStartDate: null,
        expiresInMs: null,
        pinDetails: null,

        directionalDetails: isIncoming
          ? {
              incoming: {
                dateReceived: getTimestamp(),
                dateServerSent: getTimestamp(),
                read: true,
                sealedSender: true,
              },
            }
          : {
              outgoing: {
                dateReceived: getTimestamp(),
                sendStatus: [
                  {
                    recipientId: chat.id,
                    timestamp: dateSent,
                    deliveryStatus: {
                      delivered: { sealedSender: true },
                    },
                  },
                ],
              },
            },

        item: {
          standardMessage: {
            text: {
              body: `Message ${i}`,
              bodyRanges: null,
            },
            quote: null,
            attachments: null,
            linkPreview: null,
            longText: null,
            reactions: null,
          },
        },
      },
    });
  }
}
