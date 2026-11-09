// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RequestHandler } from 'micro';
import { Server } from '../base';
import { grpcRoute, authenticatedGrpcRoute } from './utils/route';

/**
 * Routes for [attachments.proto](../../../protos/server/org/signal/chat/attachments.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createAttachmentsRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onGetUploadForm = grpcRoute(
    server,
    'org.signal.chat.attachments.Attachments/GetUploadForm',
    async () => {
      const { cdn, key, headers, signedUploadLocation } =
        await server.getAttachmentUploadForm('attachments', uuidv4());
      return {
        outcome: {
          uploadForm: {
            cdn,
            key,
            headers: new Map(Object.entries(headers)),
            signedUploadLocation,
          },
        },
      };
    },
  );

  const onGetStickerUploadForm = authenticatedGrpcRoute(
    server,
    'org.signal.chat.attachments.Attachments/GetStickerUploadForm',
    async ({ stickerCount }) => {
      const packId = crypto.randomBytes(16).toString('hex');

      // TODO: Accept uploads with these forms and store the sticker pack
      function toUploadForm(key: string) {
        return {
          key,
          credential: '',
          acl: '',
          algorithm: '',
          date: '',
          policy: '',
          signature: '',
        };
      }

      return {
        packId,
        manifestUploadForm: toUploadForm(`stickers/${packId}/manifest.proto`),
        stickerUploadForms: Array.from({ length: stickerCount }, (_, index) =>
          toUploadForm(`stickers/${packId}/full/${index}`),
        ),
      };
    },
  );

  return [onGetUploadForm, onGetStickerUploadForm];
}
