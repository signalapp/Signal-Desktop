// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import type { ServerResponse } from 'http';
import { Buffer } from 'buffer';
import createDebug from 'debug';
import { stringify as stringifyUuid, v4 as uuidv4 } from 'uuid';
import { RequestHandler, buffer, send as sendRaw } from 'micro';
import {
  AugmentedRequestHandler as RouteHandler,
  del,
  get,
  head,
  options,
  patch,
  post,
  put,
  router,
  type ServerRequest,
} from 'microrouter';
import { ServiceId, Aci, Pni } from '@signalapp/libsignal-client';
import SealedSenderMultiRecipientMessage from '@signalapp/libsignal-client/dist/SealedSenderMultiRecipientMessage';
import { Message } from '../data/schemas';
import type { Device } from '../data/device';

import { DeviceId, RegistrationId, ServiceIdString } from '../types';
import { $services, org, signalservice as Proto } from '../../protos/compiled';
import {
  AttachmentUploadForm,
  BackupAuthError,
  BackupInfo,
  BackupMediaBatchResult,
  BackupMediaList,
  Server,
} from './base';
import { parsePassword } from './common';
import { fromURLSafeBase64, toURLSafeBase64 } from '../util';

const debug = createDebug('mock:grpc');

async function auth(
  server: Server,
  req: ServerRequest,
): Promise<Device | undefined> {
  const { username, password, error } = parsePassword(req);
  if (error) {
    debug('%s %s auth failed, error %j', req.method, req.url, error);
    return;
  }

  const device = await server.auth(username ?? '', password ?? '');
  if (!device) {
    debug('%s %s auth failed, need re-provisioning', req.method, req.url);
    return;
  }

  return device;
}

const ALL_METHODS = [get, post, put, patch, del, head, options] as const;

function toServiceIdentifier(
  string: ServiceIdString,
): org.signal.chat.common.ServiceIdentifier.Params {
  const object = ServiceId.parseFromServiceIdString(string);
  if (object instanceof Pni) {
    return {
      identityType: org.signal.chat.common.IdentityType.IDENTITY_TYPE_PNI,
      uuid: object.getRawUuidBytes(),
    };
  }

  if (object instanceof Aci) {
    return {
      identityType: org.signal.chat.common.IdentityType.IDENTITY_TYPE_ACI,
      uuid: object.getRawUuidBytes(),
    };
  }

  throw new Error(`Invalid service id: ${string}`);
}

// gRPC status codes used by the mock.
const GRPC_STATUS_OK = 0;
const GRPC_STATUS_UNKNOWN = 2;
const GRPC_STATUS_UNAUTHENTICATED = 16;

class GrpcAuthError extends Error {}

// A gRPC response over HTTP/2 always uses HTTP status 200; the actual gRPC
// status code is carried in the trailing HEADERS frame (`grpc-status`). `micro`
// has no notion of trailers, so we emit them via the HTTP/2 compat API. (Driving
// the raw stream directly conflicts with the Http2ServerResponse that `micro`
// holds and throws ERR_HTTP2_TRAILERS_ALREADY_SENT.)
function sendGrpcResponse(
  res: ServerResponse,
  body: Buffer,
  status: number,
  message?: string,
): void {
  const trailers: Record<string, string> = {
    'grpc-status': String(status),
  };
  if (message !== undefined) {
    // Per the gRPC spec, `grpc-message` is percent-encoded.
    trailers['grpc-message'] = encodeURIComponent(message);
  }

  res.writeHead(200, { 'content-type': 'application/grpc' });
  res.addTrailers(trailers);
  res.end(body);
}

type GrpcRequest<Endpoint extends keyof typeof $services> = ReturnType<
  (typeof $services)[Endpoint]['Request']['decode']
>;

type GrpcResponse<Endpoint extends keyof typeof $services> = Parameters<
  (typeof $services)[Endpoint]['Response']['encode']
>[0];

export const createHandler = (server: Server): RequestHandler => {
  function grpcRoute<Endpoint extends keyof typeof $services>(
    endpoint: Endpoint,
    handler: (
      request: GrpcRequest<Endpoint>,
      device: Device | undefined,
    ) => Promise<GrpcResponse<Endpoint>>,
  ) {
    const definition = $services[endpoint];
    // TODO(indutny): enforce on type level, and support true response streams
    if (definition.isRequestStream) {
      throw new Error(`Request stream is not supported`);
    }
    return post(`/${endpoint}`, async (httpReq, res) => {
      try {
        const raw = await buffer(httpReq);
        assert(Buffer.isBuffer(raw));
        assert(raw.buffer instanceof ArrayBuffer);

        if (raw.length < 5) {
          throw new Error('gRPC request is too short');
        }

        if (raw[0] !== 0) {
          throw new Error('Unsupported request compression');
        }

        const len = raw.readUint32BE(1);
        if (raw.length !== 5 + len) {
          throw new Error('Invalid gRPC request size');
        }

        const grpcRequest = definition.Request.decode(
          raw.subarray(5, 5 + len) as Uint8Array<ArrayBuffer>,
        );

        const device = await auth(server, httpReq);

        const response = await handler(
          grpcRequest as Parameters<typeof handler>[0],
          device,
        );

        const data = (
          definition.Response.encode as (
            params: unknown,
          ) => Uint8Array<ArrayBuffer>
        )(response);
        const header = Buffer.alloc(5);
        header.writeUint32BE(data.length, 1);
        sendGrpcResponse(res, Buffer.concat([header, data]), GRPC_STATUS_OK);
      } catch (error) {
        debug('gRPC handler error for %s', endpoint, error);
        sendGrpcResponse(
          res,
          Buffer.alloc(0),
          error instanceof GrpcAuthError
            ? GRPC_STATUS_UNAUTHENTICATED
            : GRPC_STATUS_UNKNOWN,
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  }

  function authenticatedGrpcRoute<Endpoint extends keyof typeof $services>(
    endpoint: Endpoint,
    handler: (
      grpcRequest: GrpcRequest<Endpoint>,
      device: Device,
    ) => Promise<GrpcResponse<Endpoint>>,
  ) {
    return grpcRoute(endpoint, async (grpcRequest, device) => {
      if (!device) {
        throw new GrpcAuthError('incorrect credentials');
      }

      return handler(grpcRequest, device);
    });
  }

  async function onMultiRecipientMessage(
    request:
      | org.signal.chat.messages.SendMultiRecipientMessageRequest
      | org.signal.chat.messages.SendMultiRecipientStoryRequest,
  ): Promise<org.signal.chat.messages.SendMultiRecipientMessageResponse.Params> {
    const {
      message: givenMessage,
      // TODO(indutny): check it at all?
      // groupSendToken,
    } = request;

    if (givenMessage == null) {
      throw new Error('Missing message');
    }

    const { timestamp, payload } = givenMessage;

    const message = new SealedSenderMultiRecipientMessage(Buffer.from(payload));

    const listByServiceId = new Map<ServiceIdString, Array<Message>>();

    const recipients = message.recipientsByServiceIdString();
    for (const [serviceId, recipient] of Object.entries(recipients)) {
      let list: Array<Message> | undefined = listByServiceId.get(
        serviceId as ServiceIdString,
      );
      if (!list) {
        list = [];
        listByServiceId.set(serviceId as ServiceIdString, list);
      }

      for (const [i, deviceId] of recipient.deviceIds.entries()) {
        const registrationId = recipient.registrationIds.at(i);

        list.push({
          type: Proto.Envelope.Type.UNIDENTIFIED_SENDER,
          destinationDeviceId: deviceId as DeviceId,
          destinationRegistrationId: registrationId as RegistrationId,
          content: Buffer.from(message.messageForRecipient(recipient)).toString(
            'base64',
          ),
        });
      }
    }

    const results = await Promise.all(
      Array.from(listByServiceId.entries()).map(
        async ([serviceId, messages]) => {
          return {
            uuid: serviceId,
            prepared: await server.prepareMultiDeviceMessage(
              undefined,
              serviceId,
              messages,
              timestamp,
            ),
          };
        },
      ),
    );

    const mismatchedDevices = results.filter(({ prepared }) => {
      return prepared.status === 'incomplete' || prepared.status === 'stale';
    });

    if (mismatchedDevices.length > 0) {
      return {
        response: {
          mismatchedDevices: {
            mismatchedDevices: mismatchedDevices.map(({ uuid, prepared }) => {
              if (prepared.status === 'incomplete') {
                return {
                  serviceIdentifier: toServiceIdentifier(uuid),
                  missingDevices: prepared.missingDevices.slice(),
                  extraDevices: prepared.extraDevices.slice(),
                  staleDevices: null,
                };
              }

              assert.ok(prepared.status === 'stale');
              return {
                serviceIdentifier: toServiceIdentifier(uuid),
                missingDevices: null,
                extraDevices: null,
                staleDevices: prepared.staleDevices.slice(),
              };
            }),
          },
        },
      };
    }

    const uuids404 = results
      .filter(({ prepared }) => prepared.status === 'unknown')
      .map(({ uuid }) => uuid);

    const ok = results.filter(({ prepared }) => prepared.status === 'ok');

    await Promise.all(
      ok.map(({ prepared }) => {
        assert.ok(prepared.status === 'ok');
        return server.handlePreparedMultiDeviceMessage(
          undefined,
          prepared.targetServiceId,
          prepared.result,
        );
      }),
    );

    return {
      response: {
        success: {
          unresolvedRecipients: uuids404.map(toServiceIdentifier),
        },
      },
    };
  }

  const onSendMultiRecipientMessage = grpcRoute(
    'org.signal.chat.messages.MessagesAnonymous/SendMultiRecipientMessage',
    onMultiRecipientMessage,
  );

  const onSendMultiRecipientStory = grpcRoute(
    'org.signal.chat.messages.MessagesAnonymous/SendMultiRecipientStory',
    onMultiRecipientMessage,
  );

  const onLookupUsernameHash = grpcRoute(
    'org.signal.chat.account.AccountsAnonymous/LookupUsernameHash',
    async ({ usernameHash }) => {
      const uuid = await server.lookupByUsernameHash(Buffer.from(usernameHash));

      if (!uuid) {
        return {
          response: {
            notFound: {},
          },
        };
      }

      return {
        response: {
          serviceIdentifier: toServiceIdentifier(uuid),
        },
      };
    },
  );

  const onLookupUsernameLink = grpcRoute(
    'org.signal.chat.account.AccountsAnonymous/LookupUsernameLink',
    async ({ usernameLinkHandle }) => {
      const usernameCiphertext = await server.lookupByUsernameLink(
        stringifyUuid(usernameLinkHandle),
      );

      if (!usernameCiphertext) {
        return {
          response: {
            notFound: {},
          },
        };
      }

      return {
        response: {
          usernameCiphertext,
        },
      };
    },
  );

  const onGetUploadForm = grpcRoute(
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

  const onSetBackupPublicKey = grpcRoute(
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

  const onGetBackupCdnCredentials = grpcRoute(
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

  const onGetBackupUploadForm = grpcRoute(
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

  const onGetMessageBackupInfo = grpcRoute(
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

  const onCopyBackupMedia = grpcRoute(
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
              objectLength: item.objectLength,
              mediaId: toURLSafeBase64(item.mediaId),
              hmacKey: Buffer.from(item.hmacKey),
              encryptionKey: Buffer.from(item.encryptionKey),
            },
          ],
        });
      } catch (error) {
        if (error instanceof BackupAuthError) {
          return {
            mediaId: null,
            response: { failedAuthentication: { description: error.message } },
          };
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
    'org.signal.chat.backup.BackupsAnonymous/ListMedia',
    async ({ signedPresentation, cursor, limit }) => {
      assert(signedPresentation != null);
      assert(limit > 0, 'Missing or invalid limit');

      let list: BackupMediaList;
      try {
        list = await server.listBackupMedia(signedPresentation, {
          cursor: cursor ?? undefined,
          limit,
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

  const onReserveUsername = authenticatedGrpcRoute(
    'org.signal.chat.account.Accounts/ReserveUsernameHash',
    async ({ usernameHashes }, device) => {
      const usernameHash = await server.reserveUsername(device.aci, {
        usernameHashes,
      });

      if (!usernameHash) {
        return {
          response: {
            usernameNotAvailable: {},
          },
        };
      }

      return {
        response: {
          usernameHash,
        },
      };
    },
  );

  const onConfirmUsername = authenticatedGrpcRoute(
    'org.signal.chat.account.Accounts/ConfirmUsernameHash',
    async (body, device) => {
      const result = await server.confirmUsername(device.aci, body);
      if (!result) {
        return {
          response: {
            reservationNotFound: {
              description:
                "Given username hash doesn't match the reserved one or no reservation found.",
            },
          },
        };
      }

      return {
        response: {
          confirmedUsernameHash: result,
        },
      };
    },
  );

  const onDeleteUsername = authenticatedGrpcRoute(
    'org.signal.chat.account.Accounts/DeleteUsernameHash',
    async (_body, device) => {
      await server.deleteUsername(device.aci);

      return {};
    },
  );

  const onSetUsernameLink = authenticatedGrpcRoute(
    'org.signal.chat.account.Accounts/SetUsernameLink',
    async ({ usernameCiphertext, keepLinkHandle }, device) => {
      const usernameLinkHandle = await server.replaceUsernameLink(
        device.aci,
        usernameCiphertext,
        { keepLinkHandle },
      );

      return {
        response: {
          usernameLinkHandle,
        },
      };
    },
  );

  const notFoundAfterAuth: RouteHandler = async (req, res) => {
    const device = await auth(server, req);
    if (!device) {
      return sendRaw(res, 401, { error: 'Not authorized' });
    }

    debug('Unsupported request %s %s', req.method, req.url);
    return sendRaw(res, 404, { error: 'Not supported yet' });
  };

  const routes = router(
    // gRPC
    onSendMultiRecipientMessage,
    onSendMultiRecipientStory,
    onLookupUsernameHash,
    onLookupUsernameLink,
    onGetUploadForm,
    onReserveUsername,
    onConfirmUsername,
    onDeleteUsername,
    onSetUsernameLink,
    onSetBackupPublicKey,
    onRefreshBackup,
    onGetBackupCdnCredentials,
    onGetBackupUploadForm,
    onGetMessageBackupInfo,
    onGetMediaBackupInfo,
    onCopyBackupMedia,
    onListBackupMedia,

    ...ALL_METHODS.map((method) => method('/*', notFoundAfterAuth)),
  );

  return (req, res) => {
    debug('got request %s %s', req.method, req.url);
    try {
      res.once('finish', () => {
        debug('response %s %s', req.method, req.url, res.statusCode);
      });
      return routes(req, res);
    } catch (error) {
      assert(error instanceof Error);
      debug('request failure %s %s', req.method, req.url, error.stack);
      return sendRaw(res, 500, error.message);
    }
  };
};
