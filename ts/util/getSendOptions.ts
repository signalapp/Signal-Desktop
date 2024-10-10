// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type {
  SendIdentifierData,
  SendMetadataType,
  SendOptionsType,
} from '../textsecure/SendMessage';
import * as Bytes from '../Bytes';
import { getRandomBytes, getZeroes } from '../Crypto';
import { getConversationMembers } from './getConversationMembers';
import { isDirectConversation, isMe } from './whatTypeOfConversation';
import { senderCertificateService } from '../services/senderCertificate';
import { shouldSharePhoneNumberWith } from './phoneNumberSharingMode';
import type { SerializedCertificateType } from '../textsecure/OutgoingMessage';
import { SenderCertificateMode } from '../textsecure/OutgoingMessage';
import { isNotNil } from './isNotNil';
import { maybeCreateGroupSendEndorsementState } from './groupSendEndorsements';

const SEALED_SENDER = {
  UNKNOWN: 0,
  ENABLED: 1,
  DISABLED: 2,
  UNRESTRICTED: 3,
};

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

  const { accessKey, sealedSender } = conversationAttrs;
  const { e164, serviceId } = conversationAttrs;

  const senderCertificate =
    await getSenderCertificateForDirectConversation(conversationAttrs);

  let identifierData: SendIdentifierData | null = null;
  // If we've never fetched user's profile, we default to what we have
  if (sealedSender === SEALED_SENDER.UNKNOWN || story) {
    identifierData = {
      accessKey:
        accessKey ||
        (story
          ? Bytes.toBase64(getZeroes(16))
          : Bytes.toBase64(getRandomBytes(16))),
      senderCertificate,
      groupSendToken: null,
    };
  }

  if (sealedSender === SEALED_SENDER.DISABLED) {
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
  } else {
    identifierData = {
      accessKey:
        accessKey && sealedSender === SEALED_SENDER.ENABLED
          ? accessKey
          : Bytes.toBase64(getRandomBytes(16)),
      senderCertificate,
      groupSendToken: null,
    };
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
