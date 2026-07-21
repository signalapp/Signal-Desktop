// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { v4 as generateUuid } from 'uuid';

import { createLogger } from '../logging/log.std.ts';
import { clearConversationDraftAttachments } from '../util/clearConversationDraftAttachments.preload.ts';
import { deleteDraftAttachment } from '../util/deleteDraftAttachment.preload.ts';
import { writeDraftAttachment } from '../util/writeDraftAttachment.preload.ts';
import { downloadAttachment } from '../textsecure/downloadAttachment.preload.ts';
import {
  readAttachmentData,
  maybeDeleteAttachmentFile,
} from '../util/migrations.preload.ts';
import {
  getAttachment,
  getAttachmentFromBackupTier,
} from '../textsecure/WebAPI.preload.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { AttachmentVariant } from '../types/Attachment.std.ts';
import { MediaTier } from '../types/AttachmentDownload.std.ts';
import { SECOND } from '../util/durations/index.std.ts';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto.node.ts';
import type { ProcessedAttachment } from '../textsecure/Types.d.ts';
import type { DraftSyncEventData } from '../textsecure/messageReceiverEvents.std.ts';

const { noop } = lodash;

const log = createLogger('DraftSyncs');

// Downloads the synced attachment from the CDN and returns its plaintext bytes
// (draft storage is a separate store, so we re-write via writeDraftAttachment).
// Mirrors downloadAndParseContactAttachment in services/contactSync.preload.ts.
async function fetchDraftAttachmentData(
  attachment: ProcessedAttachment
): Promise<Uint8Array<ArrayBuffer>> {
  const abortController = new AbortController();
  let downloaded: ReencryptedAttachmentV2 | undefined;
  try {
    downloaded = await downloadAttachment(
      { getAttachment, getAttachmentFromBackupTier },
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        disableRetries: true,
        timeout: 90 * SECOND,
        abortSignal: abortController.signal,
        logId: 'DraftSyncs.fetchDraftAttachmentData',
      }
    );
    return await readAttachmentData(downloaded);
  } finally {
    if (downloaded?.path) {
      await maybeDeleteAttachmentFile(downloaded.path);
    }
  }
}

// Applies an incoming draft-attachment sync to the target 1:1 conversation.
// Unlike read/view syncs, a draft sync references a conversation (not a message
// that may still be in flight), so there's no out-of-order matching — we apply
// immediately, guarded by draftTimestamp for last-writer-wins.
//
// `fetchData` is a seam: it defaults to the real CDN download but is injected in
// tests so the write+apply path can run without a network/CDN.
export async function applyDraftSync(
  data: DraftSyncEventData,
  fetchData: (
    attachment: ProcessedAttachment
  ) => Promise<Uint8Array<ArrayBuffer>> = fetchDraftAttachmentData
): Promise<void> {
  const { destinationServiceId, timestamp, clear, attachment } = data;
  const logId = `DraftSyncs.applyDraftSync(envelope=${data.envelopeTimestamp})`;

  if (!destinationServiceId) {
    log.error(`${logId}: missing destinationServiceId`);
    return;
  }

  // 1:1 only: draft attachments are keyed by the other party's serviceId.
  const conversation = window.ConversationController.get(destinationServiceId);
  if (!conversation) {
    log.warn(`${logId}: no conversation for destinationServiceId`);
    return;
  }

  // Last-writer-wins: ignore syncs not newer than the local draft.
  const localTimestamp = conversation.get('draftTimestamp') ?? 0;
  if (timestamp != null && timestamp <= localTimestamp) {
    log.info(`${logId}: ignoring stale draft sync`);
    return;
  }

  if (clear) {
    log.info(`${logId}: clearing draft attachments`);
    conversation.set({ draftTimestamp: timestamp ?? null });
    // clearConversationDraftAttachments persists conversation.attributes, so the
    // draftTimestamp set above is written in the same update.
    await clearConversationDraftAttachments(
      conversation.id,
      conversation.get('draftAttachments')
    );
    return;
  }

  if (!attachment) {
    log.warn(`${logId}: non-clear draft sync without attachment, dropping`);
    return;
  }

  const bytes = await fetchData(attachment);
  const written = await writeDraftAttachment({
    data: bytes,
    clientUuid: generateUuid(),
    pending: false,
    contentType: attachment.contentType,
    size: attachment.size,
    fileName: attachment.fileName,
  });

  // Whatever we replace must have its files deleted, or they orphan on disk.
  const replaced = conversation.get('draftAttachments') ?? [];

  conversation.set({
    draftAttachments: [written],
    draftChanged: true,
    draftTimestamp: timestamp ?? null,
  });
  window.reduxActions.composer.replaceAttachments(conversation.id, [written]);
  await DataWriter.updateConversation(conversation.attributes);

  await Promise.all(replaced.map(item => deleteDraftAttachment(item)));
  log.info(`${logId}: applied synced draft attachment`);
}
