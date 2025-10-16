// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type {
  SendIdentifierData,
  SendMetadataType,
  SendOptionsType,
} from '../textsecure/SendMessage.preload.js';
import { getConversationMembers } from './getConversationMembers.dom.js';
import { isDirectConversation, isMe } from './whatTypeOfConversation.dom.js';
import { senderCertificateService } from '../services/senderCertificate.preload.js';
import { shouldSharePhoneNumberWith } from './phoneNumberSharingMode.preload.js';
import type { SerializedCertificateType } from '../textsecure/OutgoingMessage.preload.js';
import { SenderCertificateMode } from '../textsecure/OutgoingMessage.preload.js';
import { ZERO_ACCESS_KEY, SEALED_SENDER } from '../types/SealedSender.std.js';
import { isNotNil } from './isNotNil.std.js';
import { maybeCreateGroupSendEndorsementState } from './groupSendEndorsements.preload.js';
import { missingCaseError } from './missingCaseError.std.js';

export async function getSendOptionsForRecipients(
  recipients: ReadonlyArray<string>,
  options?: { story?: boolean }
): Promise<SendOptionsType> {
  const conversations = recipients
    .map(identifier => window.ConversationController.get(identifier))
    .filter(isNotNil);

  const metadataList = await Promise.all(
    conversations.map(conversation =>
      getSendOptions(conversation.attributes, options)
    )
  );

  return metadataList.reduce(
    (acc, current): SendOptionsType => {
      const { sendMetadata: accMetadata } = acc;
      const { sendMetadata: currentMetadata } = current;

      if (!currentMetadata) {
        return acc;
      }
      if (!accMetadata) {
        return current;
      }

      Object.assign(accMetadata, currentMetadata);

      return acc;
    },
    {
      sendMetadata: {},
    }
  );
}

export async function getSendOptions(
  conversationAttrs: ConversationAttributesType,
  options: { syncMessage?: boolean; story?: boolean; groupId?: string } = {},
  alreadyRefreshedGroupState = false
): Promise<SendOptionsType> {
  const { syncMessage, story, groupId } = options;

  if (!isDirectConversation(conversationAttrs)) {
    const contactCollection = getConversationMembers(conversationAttrs);
    const sendMetadata: SendMetadataType = {};
    await Promise.all(
      contactCollection.map(async contactAttrs => {
        const conversation = window.ConversationController.get(contactAttrs.id);
        if (!conversation) {
          return;
        }
        const { sendMetadata: conversationSendMetadata } = await getSendOptions(
          conversation.attributes,
          options
        );
        Object.assign(sendMetadata, conversationSendMetadata || {});
      })
    );
    return { sendMetadata };
  }

  // We never send sync messages or to our own account as sealed sender
  if (syncMessage || isMe(conversationAttrs)) {
    return {
      sendMetadata: undefined,
    };
  }

  const { accessKey } = conversationAttrs;
  const { e164, serviceId } = conversationAttrs;

  let sealedSender = conversationAttrs.sealedSender as
    | SEALED_SENDER
    | undefined;

  const senderCertificate =
    await getSenderCertificateForDirectConversation(conversationAttrs);

  let identifierData: SendIdentifierData | null = null;
  if (story) {
    // Always send story using zero access key
    sealedSender = SEALED_SENDER.UNRESTRICTED;
  }

  switch (sealedSender) {
    case SEALED_SENDER.DISABLED:
      // Try to get GSE token
      if (serviceId != null && groupId != null) {
        const { state: groupSendEndorsementState, didRefreshGroupState } =
          await maybeCreateGroupSendEndorsementState(
            groupId,
            alreadyRefreshedGroupState
          );

        if (
          groupSendEndorsementState != null &&
          groupSendEndorsementState.hasMember(serviceId)
        ) {
          const token = groupSendEndorsementState.buildToken(
            new Set([serviceId])
          );
          if (token != null) {
            identifierData = {
              accessKey: null,
              senderCertificate,
              groupSendToken: token,
            };
          }
        } else if (didRefreshGroupState && !alreadyRefreshedGroupState) {
          return getSendOptions(conversationAttrs, options, true);
        }
      }
      break;
    case SEALED_SENDER.UNRESTRICTED:
      identifierData = {
        accessKey: ZERO_ACCESS_KEY,
        senderCertificate,
        groupSendToken: null,
      };
      break;
    case SEALED_SENDER.ENABLED:
    case SEALED_SENDER.UNKNOWN:
    case undefined:
      identifierData = {
        accessKey: accessKey || ZERO_ACCESS_KEY,
        senderCertificate,
        groupSendToken: null,
      };
      break;
    default:
      throw missingCaseError(sealedSender);
  }

  let sendMetadata: SendMetadataType = {};
  if (identifierData != null) {
    sendMetadata = {
      ...(e164 ? { [e164]: identifierData } : {}),
      ...(serviceId ? { [serviceId]: identifierData } : {}),
    };
  }

  return { sendMetadata };
}

async function getSenderCertificateForDirectConversation(
  conversationAttrs: ConversationAttributesType
): Promise<SerializedCertificateType | null> {
  if (!isDirectConversation(conversationAttrs)) {
    throw new Error(
      'getSenderCertificateForDirectConversation should only be called for direct conversations'
    );
  }

  let certificateMode: SenderCertificateMode;
  if (shouldSharePhoneNumberWith(conversationAttrs)) {
    certificateMode = SenderCertificateMode.WithE164;
  } else {
    certificateMode = SenderCertificateMode.WithoutE164;
  }

  return (await senderCertificateService.get(certificateMode)) ?? null;
}
