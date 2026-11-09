// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import { RequestHandler } from 'micro';
import SealedSenderMultiRecipientMessage from '@signalapp/libsignal-client/dist/SealedSenderMultiRecipientMessage';
import { Message } from '../../data/schemas';
import type { Device } from '../../data/device';
import { DeviceId, RegistrationId, ServiceIdString } from '../../types';
import { org, signalservice as Proto } from '../../../protos/compiled';
import { Server } from '../base';
import { isValidAccessKey, unreachable } from '../../util';
import { toServiceIdentifier, fromServiceIdentifier } from './utils/serviceId';
import { grpcRoute, authenticatedGrpcRoute } from './utils/route';

type SendMessageAuthenticatedSenderResult = NonNullable<
  org.signal.chat.messages.SendMessageAuthenticatedSenderResponse.Params['response']
>;

type SendMessageResult = NonNullable<
  org.signal.chat.messages.SendMessageResponse.Params['response']
>;

// Only responses that can be returned by both
type SendIndividualMessageResult = SendMessageAuthenticatedSenderResult &
  SendMessageResult;

function fromMessageBundle(
  bundle: org.signal.chat.messages.IndividualRecipientMessageBundle,
): Array<Message> {
  return Array.from(bundle.messages.entries()).map(([deviceId, message]) => {
    if (!message) {
      throw new Error('Missing message');
    }

    return {
      type: convertSendMessageType(message.type),
      destinationDeviceId: deviceId as DeviceId,
      destinationRegistrationId: message.registrationId as RegistrationId,
      // TODO(indutny): pass buffer
      content: Buffer.from(message.payload).toString('base64'),
    };
  });
}

function convertSendMessageType(
  type: org.signal.chat.messages.SendMessageType,
): Proto.Envelope.Type {
  const { SendMessageType } = org.signal.chat.messages;
  switch (type) {
    case SendMessageType.UNSPECIFIED:
      return Proto.Envelope.Type.UNKNOWN;
    case SendMessageType.DOUBLE_RATCHET:
      return Proto.Envelope.Type.DOUBLE_RATCHET;
    case SendMessageType.PREKEY_MESSAGE:
      return Proto.Envelope.Type.PREKEY_MESSAGE;
    case SendMessageType.PLAINTEXT_CONTENT:
      return Proto.Envelope.Type.PLAINTEXT_CONTENT;
    case SendMessageType.UNIDENTIFIED_SENDER:
      return Proto.Envelope.Type.UNIDENTIFIED_SENDER;
    default:
      throw new Error(`Unsupported SendMessageType: ${type}`);
  }
}

/**
 * Routes for [messages.proto](../../../protos/server/org/signal/chat/messages.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createMessagesRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  // Returns a `response` that is valid for both authenticated sends
  // (SendMessage, SendSyncMessage) and the sealed sender SendSingleRecipientMessage
  async function sendIndividualMessage(
    source: Device | undefined,
    targetServiceId: ServiceIdString,
    bundle: org.signal.chat.messages.IndividualRecipientMessageBundle | null,
  ): Promise<SendIndividualMessageResult> {
    if (bundle == null) {
      throw new Error('Missing bundle');
    }

    const prepared = await server.prepareMultiDeviceMessage(
      source,
      targetServiceId,
      fromMessageBundle(bundle),
      bundle.timestamp,
    );

    if (prepared.status === 'ok') {
      await server.handlePreparedMultiDeviceMessage(
        source,
        prepared.targetServiceId,
        prepared.result,
      );
      return { success: {} };
    }

    if (prepared.status === 'unknown') {
      return { destinationNotFound: {} };
    }

    if (prepared.status === 'incomplete') {
      return {
        mismatchedDevices: {
          serviceIdentifier: toServiceIdentifier(targetServiceId),
          missingDevices: prepared.missingDevices.slice(),
          extraDevices: prepared.extraDevices.slice(),
          staleDevices: null,
        },
      };
    }

    if (prepared.status === 'stale') {
      return {
        mismatchedDevices: {
          serviceIdentifier: toServiceIdentifier(targetServiceId),
          missingDevices: null,
          extraDevices: null,
          staleDevices: prepared.staleDevices.slice(),
        },
      };
    }

    unreachable(prepared);
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

  const onSendMessage = authenticatedGrpcRoute(
    server,
    'org.signal.chat.messages.Messages/SendMessage',
    async ({ destination, messages }, device) => {
      const targetServiceId = fromServiceIdentifier(destination);

      if (
        server.isSendRateLimited({
          source: device.aci,
          target: targetServiceId,
        })
      ) {
        return {
          response: {
            challengeRequired: {
              token: 'token',
              challengeOptions: [
                org.signal.chat.messages.ChallengeRequired.ChallengeType
                  .CAPTCHA,
              ],
              retryAfterSeconds: null,
            },
          },
        };
      }

      return {
        response: await sendIndividualMessage(
          device,
          targetServiceId,
          messages,
        ),
      };
    },
  );

  const onSendSyncMessage = authenticatedGrpcRoute(
    server,
    'org.signal.chat.messages.Messages/SendSyncMessage',
    async ({ messages }, device) => {
      return {
        // Sending to ourselves
        response: await sendIndividualMessage(device, device.aci, messages),
      };
    },
  );

  const onReportMessage = authenticatedGrpcRoute(
    server,
    'org.signal.chat.messages.Messages/ReportMessage',
    async () => {
      // TODO: Record reported messages
      return {};
    },
  );

  const onSendSingleRecipientMessage = grpcRoute(
    server,
    'org.signal.chat.messages.MessagesAnonymous/SendSingleRecipientMessage',
    async ({ destination, messages, authorization }) => {
      const targetServiceId = fromServiceIdentifier(destination);
      const target = await server.getDeviceByServiceId(targetServiceId);
      const exists = target != null && !server.isUnregistered(targetServiceId);

      // An unknown destination is "not found" for group send tokens, but an
      // authorization failure for access keys so that access keys can't be
      // used to probe whether an account exists.
      if (authorization?.groupSendToken != null) {
        // TODO: Verify group send tokens
        if (!exists) {
          return { response: { destinationNotFound: {} } };
        }
      } else {
        // TODO: Support unrestricted unidentified access. Until then,
        // `unrestrictedAccess` is always rejected.
        const accessKey = authorization?.unidentifiedAccessKey ?? null;
        if (!exists || !isValidAccessKey(accessKey, target)) {
          return {
            response: {
              failedUnidentifiedAuthorization: {
                description: 'Invalid access key',
              },
            },
          };
        }
      }

      return {
        response: await sendIndividualMessage(
          undefined,
          targetServiceId,
          messages,
        ),
      };
    },
  );

  const onSendMultiRecipientMessage = grpcRoute(
    server,
    'org.signal.chat.messages.MessagesAnonymous/SendMultiRecipientMessage',
    onMultiRecipientMessage,
  );

  const onSendStory = grpcRoute(
    server,
    'org.signal.chat.messages.MessagesAnonymous/SendStory',
    async ({ destination, messages }) => {
      const targetServiceId = fromServiceIdentifier(destination);
      const target = await server.getDeviceByServiceId(targetServiceId);
      if (target == null || server.isUnregistered(targetServiceId)) {
        return { response: { destinationNotFound: {} } };
      }

      return {
        response: await sendIndividualMessage(
          undefined,
          targetServiceId,
          messages,
        ),
      };
    },
  );

  const onSendMultiRecipientStory = grpcRoute(
    server,
    'org.signal.chat.messages.MessagesAnonymous/SendMultiRecipientStory',
    onMultiRecipientMessage,
  );

  return [
    onSendMessage,
    onSendSyncMessage,
    onReportMessage,
    onSendSingleRecipientMessage,
    onSendMultiRecipientMessage,
    onSendStory,
    onSendMultiRecipientStory,
  ];
}
