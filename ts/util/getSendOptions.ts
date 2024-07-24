// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type {
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
  options: { syncMessage?: boolean; story?: boolean } = {}
): Promise<SendOptionsType> {
  const { syncMessage, story } = options;

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

  const { accessKey, sealedSender } = conversationAttrs;

  // We never send sync messages or to our own account as sealed sender
  if (syncMessage || isMe(conversationAttrs)) {
    return {
      sendMetadata: undefined,
    };
  }

  const { e164, serviceId } = conversationAttrs;

  const senderCertificate =
    await getSenderCertificateForDirectConversation(conversationAttrs);

  // If we've never fetched user's profile, we default to what we have
  if (sealedSender === SEALED_SENDER.UNKNOWN || story) {
    const identifierData = {
      accessKey:
        accessKey ||
        (story
          ? Bytes.toBase64(getZeroes(16))
          : Bytes.toBase64(getRandomBytes(16))),
      senderCertificate,
    };
    return {
      sendMetadata: {
        ...(e164 ? { [e164]: identifierData } : {}),
        ...(serviceId ? { [serviceId]: identifierData } : {}),
      },
    };
  }

  if (sealedSender === SEALED_SENDER.DISABLED) {
    return {
      sendMetadata: undefined,
    };
  }

  const identifierData = {
    accessKey:
      accessKey && sealedSender === SEALED_SENDER.ENABLED
        ? accessKey
        : Bytes.toBase64(getRandomBytes(16)),
    senderCertificate,
  };

  return {
    sendMetadata: {
      ...(e164 ? { [e164]: identifierData } : {}),
      ...(serviceId ? { [serviceId]: identifierData } : {}),
    },
  };
}

function getSenderCertificateForDirectConversation(
  conversationAttrs: ConversationAttributesType
): Promise<undefined | SerializedCertificateType> {
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

  return senderCertificateService.get(certificateMode);
}
