// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type {
  SendMetadataType,
  SendOptionsType,
} from '../textsecure/SendMessage';
import * as Bytes from '../Bytes';
import { getRandomBytes } from '../Crypto';
import { getConversationMembers } from './getConversationMembers';
import { isDirectConversation, isMe } from './whatTypeOfConversation';
import { isInSystemContacts } from './isInSystemContacts';
import { missingCaseError } from './missingCaseError';
import { senderCertificateService } from '../services/senderCertificate';
import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from './phoneNumberSharingMode';
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
  recipients: ReadonlyArray<string>
): Promise<SendOptionsType> {
  const conversations = recipients
    .map(identifier => window.ConversationController.get(identifier))
    .filter(isNotNil);

  const metadataList = await Promise.all(
    conversations.map(conversation => getSendOptions(conversation.attributes))
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
  options: { syncMessage?: boolean } = {}
): Promise<SendOptionsType> {
  const { syncMessage } = options;

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

  const { e164, uuid } = conversationAttrs;

  const senderCertificate = await getSenderCertificateForDirectConversation(
    conversationAttrs
  );

  // If we've never fetched user's profile, we default to what we have
  if (sealedSender === SEALED_SENDER.UNKNOWN) {
    const identifierData = {
      accessKey: accessKey || Bytes.toBase64(getRandomBytes(16)),
      senderCertificate,
    };
    return {
      sendMetadata: {
        ...(e164 ? { [e164]: identifierData } : {}),
        ...(uuid ? { [uuid]: identifierData } : {}),
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
      ...(uuid ? { [uuid]: identifierData } : {}),
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

  const phoneNumberSharingMode = parsePhoneNumberSharingMode(
    window.storage.get('phoneNumberSharingMode')
  );

  let certificateMode: SenderCertificateMode;
  switch (phoneNumberSharingMode) {
    case PhoneNumberSharingMode.Everybody:
      certificateMode = SenderCertificateMode.WithE164;
      break;
    case PhoneNumberSharingMode.ContactsOnly:
      certificateMode = isInSystemContacts(conversationAttrs)
        ? SenderCertificateMode.WithE164
        : SenderCertificateMode.WithoutE164;
      break;
    case PhoneNumberSharingMode.Nobody:
      certificateMode = SenderCertificateMode.WithoutE164;
      break;
    default:
      throw missingCaseError(phoneNumberSharingMode);
  }

  return senderCertificateService.get(certificateMode);
}
