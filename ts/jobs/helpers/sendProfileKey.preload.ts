// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { ContentHint } from '@signalapp/libsignal-client';

import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import {
  isDirectConversation,
  isGroup,
  isGroupV2,
} from '../../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  ProfileKeyJobData,
} from '../conversationJobQueue.preload.js';
import type { CallbackResultType } from '../../textsecure/Types.d.ts';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import type { ConversationAttributesType } from '../../model-types.d.ts';
import {
  OutgoingIdentityKeyError,
  SendMessageChallengeError,
  SendMessageProtoError,
  UnregisteredUserError,
} from '../../textsecure/Errors.std.js';
import { shouldSendToConversation } from './shouldSendToConversation.preload.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { isNumber } = lodash;

export function canAllErrorsBeIgnored(
  conversation: ConversationAttributesType,
  error: unknown
): boolean {
  if (
    error instanceof OutgoingIdentityKeyError ||
    error instanceof SendMessageChallengeError ||
    error instanceof UnregisteredUserError
  ) {
    return true;
  }

  return Boolean(
    isGroup(conversation) &&
      error instanceof SendMessageProtoError &&
      error.errors?.every(
        item =>
          item instanceof OutgoingIdentityKeyError ||
          item instanceof SendMessageChallengeError ||
          item instanceof UnregisteredUserError
      )
  );
}

// Note: because we don't have a recipient map, we will resend this message to folks that
//   got it on the first go-round, if some sends fail. This is okay, because a recipient
//   getting your profileKey again is just fine.
export async function sendProfileKey(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: ProfileKeyJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending profile key');
    return;
  }

  if (!data?.isOneTimeSend && !conversation.get('profileSharing')) {
    log.info('No longer sharing profile. Canceling job.');
    return;
  }

  const profileKey = await ourProfileKeyService.get();
  if (!profileKey) {
    log.info('Unable to fetch profile. Canceling job.');
    return;
  }

  log.info(
    `starting profile key share to ${conversation.idForLogging()} with timestamp ${timestamp} type=${data.type}`
  );

  const { revision } = data;
  const sendOptions = await getSendOptions(conversation.attributes);
  const contentHint = ContentHint.Resendable;
  const sendType = 'profileKeyUpdate';

  let sendPromise: Promise<CallbackResultType>;

  // Note: flags and the profileKey itself are all that matter in the proto.

  if (!shouldSendToConversation(conversation, log)) {
    return;
  }

  if (isDirectConversation(conversation.attributes)) {
    if (isConversationUnregistered(conversation.attributes)) {
      log.info(
        `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
      );
      return;
    }

    const proto = await messaging.getContentMessage({
      flags: Proto.DataMessage.Flags.PROFILE_KEY_UPDATE,
      profileKey,
      recipients: conversation.getRecipients(),
      expireTimerVersion: undefined,
      timestamp,
      includePniSignatureMessage: true,
    });
    sendPromise = messaging.sendIndividualProto({
      contentHint,
      serviceId: conversation.getSendTarget(),
      options: sendOptions,
      proto,
      timestamp,
      urgent: false,
    });
  } else {
    if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
      log.error('No revision provided, but conversation is GroupV2');
    }

    const ourAci = itemStorage.user.getCheckedAci();
    if (!conversation.hasMember(ourAci)) {
      log.info(
        `We are not part of group ${conversation.idForLogging()}; refusing to send`
      );
      return;
    }

    const groupV2Info = conversation.getGroupV2Info();
    if (groupV2Info && isNumber(revision)) {
      groupV2Info.revision = revision;
    }

    sendPromise = sendToGroup({
      contentHint,
      groupSendOptions: {
        flags: Proto.DataMessage.Flags.PROFILE_KEY_UPDATE,
        groupV2: groupV2Info,
        profileKey,
        timestamp,
      },
      messageId: undefined,
      sendOptions,
      sendTarget: conversation.toSenderKeyTarget(),
      sendType,
      urgent: false,
    });
  }

  try {
    await handleMessageSend(sendPromise, {
      messageIds: [],
      sendType,
    });
  } catch (error: unknown) {
    if (canAllErrorsBeIgnored(conversation.attributes, error)) {
      log.info(
        'Group send failures were all OutgoingIdentityKeyError, SendMessageChallengeError, or UnregisteredUserError. Returning successfully.'
      );
      return;
    }

    await handleMultipleSendErrors({
      errors: maybeExpandErrors(error),
      isFinalAttempt,
      log,
      timeRemaining,
      toThrow: error,
    });
  }
}
