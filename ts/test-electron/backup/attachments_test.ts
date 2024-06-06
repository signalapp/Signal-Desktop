// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { omit } from 'lodash';

import type { ConversationModel } from '../../models/conversations';
import * as Bytes from '../../Bytes';
import Data from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { loadCallsHistory } from '../../services/callHistoryLoader';
import { setupBasics, asymmetricRoundtripHarness } from './helpers';
import { AUDIO_MP3, IMAGE_JPEG } from '../../types/MIME';
import type { MessageAttributesType } from '../../model-types';
import { isVoiceMessage, type AttachmentType } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import { SignalService } from '../../protobuf';

const CONTACT_A = generateAci();

describe('backup/attachments', () => {
  let contactA: ConversationModel;

  beforeEach(async () => {
    await Data._removeAllMessages();
    await Data._removeAllConversations();
    window.storage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A' }
    );

    await loadCallsHistory();
  });

  function getBase64(str: string): string {
    return Bytes.toBase64(Bytes.fromString(str));
  }

  function composeAttachment(
    index: number,
    overrides?: Partial<AttachmentType>
  ): AttachmentType {
    return {
      cdnKey: `cdnKey${index}`,
      cdnNumber: 3,
      key: getBase64(`key${index}`),
      digest: getBase64(`digest${index}`),
      iv: getBase64(`iv${index}`),
      size: 100,
      contentType: IMAGE_JPEG,
      path: `/path/to/file${index}.png`,
      uploadTimestamp: index,
      ...overrides,
    };
  }

  function composeMessage(
    timestamp: number,
    overrides?: Partial<MessageAttributesType>
  ): MessageAttributesType {
    return {
      conversationId: contactA.id,
      id: generateGuid(),
      type: 'incoming',
      received_at: timestamp,
      received_at_ms: timestamp,
      sourceServiceId: CONTACT_A,
      sourceDevice: timestamp,
      sent_at: timestamp,
      timestamp,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
      ...overrides,
    };
  }

  describe('normal attachments', () => {
    it('BackupLevel.Messages, roundtrips normal attachments', async () => {
      const attachment1 = composeAttachment(1);
      const attachment2 = composeAttachment(2);

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment1, attachment2],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            attachments: [
              omit(attachment1, ['path', 'iv']),
              omit(attachment2, ['path', 'iv']),
            ],
          }),
        ],
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips normal attachments', async () => {
      const attachment = composeAttachment(1);
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment],
          }),
        ],
        [
          composeMessage(1, {
            // path, iv, and uploadTimestamp will not be roundtripped,
            // but there will be a backupLocator
            attachments: [
              {
                ...omit(attachment, ['path', 'iv', 'uploadTimestamp']),
                backupLocator: { mediaName: attachment.digest },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
    it('roundtrips voice message attachments', async () => {
      const attachment = composeAttachment(1);
      attachment.contentType = AUDIO_MP3;
      attachment.flags = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;

      strictAssert(isVoiceMessage(attachment), 'it is a voice attachment');
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment],
          }),
        ],
        [
          composeMessage(1, {
            attachments: [
              {
                ...omit(attachment, ['path', 'iv', 'uploadTimestamp']),
                backupLocator: { mediaName: attachment.digest },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });

  describe('Preview attachments', () => {
    it('BackupLevel.Messages, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1);

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            preview: [{ url: 'url', date: 1, image: attachment }],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            preview: [
              { url: 'url', date: 1, image: omit(attachment, ['path', 'iv']) },
            ],
          }),
        ],
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1);
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            preview: [
              {
                url: 'url',
                date: 1,
                title: 'title',
                description: 'description',
                image: attachment,
              },
            ],
          }),
        ],
        [
          composeMessage(1, {
            preview: [
              {
                url: 'url',
                date: 1,
                title: 'title',
                description: 'description',
                image: {
                  // path, iv, and uploadTimestamp will not be roundtripped,
                  // but there will be a backupLocator
                  ...omit(attachment, ['path', 'iv', 'uploadTimestamp']),
                  backupLocator: { mediaName: attachment.digest },
                },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });

  describe('contact attachments', () => {
    it('BackupLevel.Messages, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1);

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            contact: [{ avatar: { avatar: attachment, isProfile: false } }],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            contact: [
              {
                avatar: {
                  avatar: omit(attachment, ['path', 'iv']),
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1);
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            contact: [{ avatar: { avatar: attachment, isProfile: false } }],
          }),
        ],
        // path, iv, and uploadTimestamp will not be roundtripped,
        // but there will be a backupLocator
        [
          composeMessage(1, {
            contact: [
              {
                avatar: {
                  avatar: {
                    ...omit(attachment, ['path', 'iv', 'uploadTimestamp']),
                    backupLocator: { mediaName: attachment.digest },
                  },
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });
});
