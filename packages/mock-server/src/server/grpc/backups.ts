// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import { RequestHandler } from 'micro';
import { org } from '../../../protos/compiled';
import {
  AttachmentUploadForm,
  BackupAuthError,
  BackupInfo,
  BackupMediaBatchResult,
  BackupMediaList,
  Server,
} from '../base';
import { fromURLSafeBase64, toURLSafeBase64 } from '../../util';
import {
  GRPC_STATUS_ABORTED,
  GrpcStatusError,
  packAny,
  signalStatusError,
} from './utils/errors';
import { grpcRoute } from './utils/route';

// For BackupsAnonymous/ListMedia
const DEFAULT_LIST_MEDIA_LIMIT = 1000;

// Backup media stream error when the backup auth credential presentation is rejected
function backupStreamClosedAuthError(description: string): GrpcStatusError {
  const closed = org.signal.chat.backup.BackupStreamClosed.encode({
    reason: { failedAuthentication: { description } },
  });
  return signalStatusError(GRPC_STATUS_ABORTED, 'STREAM_CLOSED', [
    packAny('org.signal.chat.backup.BackupStreamClosed', closed),
  ]);
}

/**
 * Routes for [backups.proto](../../../protos/server/org/signal/chat/backups.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createBackupsRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onGetBackupCdnCredentials = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/GetCdnCredentials',
    async ({ signedPresentation, cdn }) => {
      assert(signedPresentation != null);

      if (cdn !== 3) {
        throw new Error(`Invalid cdn: ${cdn}`);
      }

      let cdnHeaders: Record<string, string>;
      try {
        cdnHeaders = await server.getBackupCDNAuth(signedPresentation);
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return {
        response: {
          cdnCredentials: { headers: new Map(Object.entries(cdnHeaders)) },
        },
      };
    },
  );

  const onGetMessageBackupInfo = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/GetMessageBackupInfo',
    async ({ signedPresentation }) => {
      assert(signedPresentation != null);

      let info: BackupInfo;
      try {
        info = await server.getBackupInfo(signedPresentation);
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return {
        response: {
          backupInfo: {
            cdn: info.cdn,
            backupDir: info.backupDir,
            backupName: info.backupName,
          },
        },
      };
    },
  );

  const onGetMediaBackupInfo = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/GetMediaBackupInfo',
    async ({ signedPresentation }) => {
      assert(signedPresentation != null);

      let info: BackupInfo;
      try {
        info = await server.getBackupInfo(signedPresentation);
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return {
        response: {
          backupInfo: {
            backupDir: info.backupDir,
            mediaDir: info.mediaDir,
            usedSpace: BigInt(info.usedSpace ?? 0),
          },
        },
      };
    },
  );

  const onSetBackupPublicKey = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/SetPublicKey',
    async ({ signedPresentation, publicKey }) => {
      assert(signedPresentation != null);

      try {
        await server.setBackupKey(signedPresentation, {
          backupIdPublicKey: Buffer.from(publicKey),
        });
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return { response: { success: {} } };
    },
  );

  const onRefreshBackup = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/Refresh',
    async ({ signedPresentation }) => {
      assert(signedPresentation != null);

      try {
        await server.refreshBackup(signedPresentation);
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return { response: { success: {} } };
    },
  );

  const onGetBackupUploadForm = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/GetUploadForm',
    async ({ signedPresentation, uploadType }) => {
      assert(signedPresentation != null);

      if (uploadType == null) {
        throw new Error('Missing uploadType');
      }

      let form: AttachmentUploadForm;
      try {
        if (uploadType.messages != null) {
          form = await server.getBackupUploadForm(signedPresentation);
        } else {
          form = await server.getBackupMediaUploadForm(signedPresentation);
        }
      } catch (error) {
        if (!(error instanceof BackupAuthError)) {
          throw error;
        }

        return {
          response: { failedAuthentication: { description: error.message } },
        };
      }

      return {
        response: {
          uploadForm: {
            cdn: form.cdn,
            key: form.key,
            headers: new Map(Object.entries(form.headers)),
            signedUploadLocation: form.signedUploadLocation,
          },
        },
      };
    },
  );

  const onCopyBackupMedia = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/CopyMedia',
    async ({ signedPresentation, items }) => {
      assert(signedPresentation != null);
      // DESKTOP-10466: Mock server does not support streaming multiple responses yet
      assert.strictEqual(
        items.length,
        1,
        'Can copy only one media object at a time',
      );
      const [item] = items;
      assert(item !== undefined);

      let batchResult: BackupMediaBatchResult;
      try {
        batchResult = await server.backupMediaBatch(signedPresentation, {
          items: [
            {
              sourceAttachment: {
                cdn: item.sourceAttachmentCdn,
                key: item.sourceKey,
              },
              // Casting from bigint since we need to send this as JSON later
              objectLength: Number(item.objectLength),
              mediaId: toURLSafeBase64(item.mediaId),
              hmacKey: Buffer.from(item.hmacKey),
              encryptionKey: Buffer.from(item.encryptionKey),
            },
          ],
        });
      } catch (error) {
        if (error instanceof BackupAuthError) {
          throw backupStreamClosedAuthError(error.message);
        }
        throw error;
      }

      const [copied] = batchResult.responses;
      assert(copied !== undefined, 'Missing copy response');

      const { mediaId } = item;
      const { result } = copied;

      if (typeof result === 'object') {
        return { mediaId, response: { success: { cdn: result.cdn } } };
      }

      switch (result) {
        case 'sourceNotFound':
          return { mediaId, response: { sourceNotFound: {} } };
        case 'wrongSourceLength':
          return { mediaId, response: { wrongSourceLength: {} } };
        case 'outOfSpace':
          return { mediaId, response: { outOfSpace: {} } };
        default:
          throw new Error(`Unsupported copy result: ${result}`);
      }
    },
  );

  const onListBackupMedia = grpcRoute(
    server,
    'org.signal.chat.backup.BackupsAnonymous/ListMedia',
    async ({ signedPresentation, cursor, limit }) => {
      assert(signedPresentation != null);
      assert(limit == null || limit > 0, 'Invalid limit');

      let list: BackupMediaList;
      try {
        list = await server.listBackupMedia(signedPresentation, {
          cursor: cursor ?? undefined,
          limit: limit ?? DEFAULT_LIST_MEDIA_LIMIT,
        });
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            response: { failedAuthentication: { description: error.message } },
          };
        }
        throw error;
      }

      return {
        response: {
          listResult: {
            page: list.storedMediaObjects.map(
              ({ cdn, mediaId, objectLength }) => ({
                cdn,
                mediaId: fromURLSafeBase64(mediaId),
                length: BigInt(objectLength),
              }),
            ),
            backupDir: list.backupDir,
            mediaDir: list.mediaDir,
            cursor: list.cursor ?? null,
          },
        },
      };
    },
  );

  return [
    onGetBackupCdnCredentials,
    onGetMessageBackupInfo,
    onGetMediaBackupInfo,
    onSetBackupPublicKey,
    onRefreshBackup,
    onGetBackupUploadForm,
    onCopyBackupMedia,
    onListBackupMedia,
  ];
}
