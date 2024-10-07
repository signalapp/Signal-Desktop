// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { createCipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import Long from 'long';

import type { AciString } from '../../types/ServiceId';
import { generateAci } from '../../types/ServiceId';
import { CipherType } from '../../types/Crypto';
import { appendPaddingStream } from '../../util/logPadding';
import { prependStream } from '../../util/prependStream';
import { appendMacStream } from '../../util/appendMacStream';
import { toAciObject } from '../../util/ServiceId';
import {
  deriveBackupKey,
  deriveBackupId,
  deriveBackupKeyMaterial,
} from '../../Crypto';
import { BACKUP_VERSION } from '../../services/backups/constants';
import { Backups } from '../../protobuf';

export type BackupGeneratorConfigType = Readonly<{
  aci: AciString;
  profileKey: Buffer;
  masterKey: Buffer;
  conversations: number;
  messages: number;
}>;

const IV_LENGTH = 16;

export type GenerateBackupResultType = Readonly<{
  backupId: Buffer;
  stream: Readable;
}>;

export function generateBackup(
  options: BackupGeneratorConfigType
): GenerateBackupResultType {
  const { aci, masterKey } = options;
  const backupKey = deriveBackupKey(masterKey);
  const aciBytes = toAciObject(aci).getServiceIdBinary();
  const backupId = Buffer.from(deriveBackupId(backupKey, aciBytes));
  const { aesKey, macKey } = deriveBackupKeyMaterial(backupKey, backupId);

  const iv = randomBytes(IV_LENGTH);

  const stream = Readable.from(createRecords(options))
    .pipe(createGzip())
    .pipe(appendPaddingStream())
    .pipe(createCipheriv(CipherType.AES256CBC, aesKey, iv))
    .pipe(prependStream(iv))
    .pipe(appendMacStream(macKey));

  return { backupId, stream };
}

function frame(data: Backups.IFrame): Buffer {
  return Buffer.from(Backups.Frame.encodeDelimited(data).finish());
}

let now = Date.now();
function getTimestamp(): Long {
  now += 1;
  return Long.fromNumber(now);
}

function* createRecords({
  profileKey,
  conversations,
  messages,
}: BackupGeneratorConfigType): Iterable<Buffer> {
  yield Buffer.from(
    Backups.BackupInfo.encodeDelimited({
      version: Long.fromNumber(BACKUP_VERSION),
      backupTimeMs: getTimestamp(),
    }).finish()
  );

  // Account data
  yield frame({
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
        phoneNumberSharingMode:
          Backups.AccountData.PhoneNumberSharingMode.EVERYBODY,
        defaultChatStyle: {
          autoBubbleColor: {},
          dimWallpaperInDarkMode: false,
        },
        customChatColors: [],
      },
    },
  });

  const selfId = Long.fromNumber(0);

  yield frame({
    recipient: {
      id: selfId,
      self: {},
    },
  });

  const chats = new Array<{
    id: Long;
    aci: Buffer;
  }>();

  for (let i = 1; i <= conversations; i += 1) {
    const id = Long.fromNumber(i);
    const chatAci = toAciObject(generateAci()).getRawUuidBytes();

    chats.push({
      id,
      aci: chatAci,
    });

    yield frame({
      recipient: {
        id,
        contact: {
          aci: chatAci,
          blocked: false,
          visibility: Backups.Contact.Visibility.VISIBLE,
          registered: {},
          profileKey: randomBytes(32),
          profileSharing: true,
          profileGivenName: `Contact ${i}`,
          profileFamilyName: 'Generated',
          hideStory: false,
        },
      },
    });

    yield frame({
      chat: {
        id,
        recipientId: id,
        archived: false,
        pinnedOrder: 0,
        expirationTimerMs: Long.fromNumber(0),
        muteUntilMs: Long.fromNumber(0),
        markedUnread: false,
        dontNotifyForMentionsIfMuted: false,
        style: {
          autoBubbleColor: {},
          dimWallpaperInDarkMode: false,
        },
        expireTimerVersion: 1,
      },
    });
  }

  for (let i = 0; i < messages; i += 1) {
    const chat = chats[i % chats.length];

    const isIncoming = i % 2 === 0;

    const dateSent = getTimestamp();

    yield frame({
      chatItem: {
        chatId: chat.id,
        authorId: isIncoming ? chat.id : selfId,
        dateSent,
        revisions: [],
        sms: false,

        ...(isIncoming
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
                sendStatus: [
                  {
                    recipientId: chat.id,
                    timestamp: dateSent,
                    sent: { sealedSender: true },
                  },
                ],
              },
            }),

        standardMessage: {
          text: {
            body: `Message ${i}`,
          },
        },
      },
    });
  }
}
