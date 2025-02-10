// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop, union } from 'lodash';

import { filter, map } from '../util/iterables';
import { isNotNil } from '../util/isNotNil';
import { SendMessageProtoError } from '../textsecure/Errors';
import { getOwn } from '../util/getOwn';
import { isGroup } from '../util/whatTypeOfConversation';
import { handleMessageSend } from '../util/handleMessageSend';
import { getSendOptions } from '../util/getSendOptions';
import * as log from '../logging/log';
import {
  getPropForTimestamp,
  getChangesForPropAtTimestamp,
} from '../util/editHelpers';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import {
  notifyStorySendFailed,
  saveErrorsOnMessage,
} from '../test-node/util/messageFailures';
import { isCustomError } from './helpers';
import { SendActionType, isSent, sendStateReducer } from './MessageSendState';

import type { CustomError, MessageAttributesType } from '../model-types.d';
import type { CallbackResultType } from '../textsecure/Types.d';
import type { MessageModel } from '../models/messages';
import type { ServiceIdString } from '../types/ServiceId';
import type { SendStateByConversationId } from './MessageSendState';

/* eslint-disable more/no-then */

export async function send(
  message: MessageModel,
  {
    promise,
    saveErrors,
    targetTimestamp,
  }: {
    promise: Promise<CallbackResultType | void | null>;
    saveErrors?: (errors: Array<Error>) => void;
    targetTimestamp: number;
  }
): Promise<void> {
  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );
  const updateLeftPane = conversation?.debouncedUpdateLastMessage ?? noop;

  updateLeftPane();

  let result:
    | { success: true; value: CallbackResultType }
    | {
        success: false;
        value: CustomError | SendMessageProtoError;
      };
  try {
    const value = await (promise as Promise<CallbackResultType>);
    result = { success: true, value };
  } catch (err) {
    result = { success: false, value: err };
  }

  updateLeftPane();

  const attributesToUpdate: Partial<MessageAttributesType> = {};

  // This is used by sendSyncMessage, then set to null
  if ('dataMessage' in result.value && result.value.dataMessage) {
    attributesToUpdate.dataMessage = result.value.dataMessage;
  } else if ('editMessage' in result.value && result.value.editMessage) {
    attributesToUpdate.dataMessage = result.value.editMessage;
  }

  if (!message.doNotSave) {
    await window.MessageCache.saveMessage(message.attributes);
  }

  const sendStateByConversationId = {
    ...(getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    }) || {}),
  };

  const sendIsNotFinal =
    'sendIsNotFinal' in result.value && result.value.sendIsNotFinal;
  const sendIsFinal = !sendIsNotFinal;

  // Capture successful sends
  const successfulServiceIds: Array<ServiceIdString> =
    sendIsFinal &&
    'successfulServiceIds' in result.value &&
    Array.isArray(result.value.successfulServiceIds)
      ? result.value.successfulServiceIds
      : [];
  const sentToAtLeastOneRecipient =
    result.success || Boolean(successfulServiceIds.length);

  successfulServiceIds.forEach(serviceId => {
    const targetConversation = window.ConversationController.get(serviceId);
    if (!targetConversation) {
      return;
    }

    // If we successfully sent to a user, we can remove our unregistered flag.
    if (targetConversation.isEverUnregistered()) {
      targetConversation.setRegistered();
    }

    const previousSendState = getOwn(
      sendStateByConversationId,
      targetConversation.id
    );
    if (previousSendState) {
      sendStateByConversationId[targetConversation.id] = sendStateReducer(
        previousSendState,
        {
          type: SendActionType.Sent,
          updatedAt: Date.now(),
        }
      );
    }
  });

  // Integrate sends via sealed sender
  const latestEditTimestamp = message.get('editMessageTimestamp');
  const sendIsLatest =
    !latestEditTimestamp || targetTimestamp === latestEditTimestamp;
  const previousUnidentifiedDeliveries =
    message.get('unidentifiedDeliveries') || [];
  const newUnidentifiedDeliveries =
    sendIsLatest &&
    sendIsFinal &&
    'unidentifiedDeliveries' in result.value &&
    Array.isArray(result.value.unidentifiedDeliveries)
      ? result.value.unidentifiedDeliveries
      : [];

  const promises: Array<Promise<unknown>> = [];

  // Process errors
  let errors: Array<CustomError>;
  if (result.value instanceof SendMessageProtoError && result.value.errors) {
    ({ errors } = result.value);
  } else if (isCustomError(result.value)) {
    errors = [result.value];
  } else if (Array.isArray(result.value.errors)) {
    ({ errors } = result.value);
  } else {
    errors = [];
  }

  // In groups, we don't treat unregistered users as a user-visible
  //   error. The message will look successful, but the details
  //   screen will show that we didn't send to these unregistered users.
  const errorsToSave: Array<CustomError> = [];

  errors.forEach(error => {
    const errorConversation =
      window.ConversationController.get(error.serviceId) ||
      window.ConversationController.get(error.number);

    if (errorConversation && !saveErrors && sendIsFinal) {
      const previousSendState = getOwn(
        sendStateByConversationId,
        errorConversation.id
      );
      if (previousSendState) {
        sendStateByConversationId[errorConversation.id] = sendStateReducer(
          previousSendState,
          {
            type: SendActionType.Failed,
            updatedAt: Date.now(),
          }
        );
        notifyStorySendFailed(message);
      }
    }

    let shouldSaveError = true;
    switch (error.name) {
      case 'OutgoingIdentityKeyError': {
        if (conversation) {
          promises.push(
            conversation.getProfiles().catch(() => {
              /* nothing to do here; logging already happened */
            })
          );
        }
        break;
      }
      case 'UnregisteredUserError':
        if (conversation && isGroup(conversation.attributes)) {
          shouldSaveError = false;
        }
        // If we just found out that we couldn't send to a user because they are no
        //   longer registered, we will update our unregistered flag. In groups we
        //   will not event try to send to them for 6 hours. And we will never try
        //   to fetch them on startup again.
        //
        // The way to discover registration once more is:
        //   1) any attempt to send to them in 1:1 conversation
        //   2) the six-hour time period has passed and we send in a group again
        conversation?.setUnregistered();
        break;
      default:
        break;
    }

    if (shouldSaveError) {
      errorsToSave.push(error);
    }
  });

  // Only update the expirationStartTimestamp if we don't already have one set
  if (!message.get('expirationStartTimestamp')) {
    attributesToUpdate.expirationStartTimestamp = sentToAtLeastOneRecipient
      ? Date.now()
      : undefined;
  }
  attributesToUpdate.unidentifiedDeliveries = union(
    previousUnidentifiedDeliveries,
    newUnidentifiedDeliveries
  );
  // We may overwrite this in the `saveErrors` call below.
  attributesToUpdate.errors = [];

  const additionalProps = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'sendStateByConversationId',
    targetTimestamp,
    value: sendStateByConversationId,
  });

  message.set({ ...attributesToUpdate, ...additionalProps });
  if (saveErrors) {
    saveErrors(errorsToSave);
  } else {
    // We skip save because we'll save in the next step.
    await saveErrorsOnMessage(message, errorsToSave, {
      skipSave: true,
    });
  }

  if (!message.doNotSave) {
    await window.MessageCache.saveMessage(message);
  }

  updateLeftPane();

  if (sentToAtLeastOneRecipient && !message.doNotSendSyncMessage) {
    promises.push(sendSyncMessage(message, targetTimestamp));
  }

  await Promise.all(promises);

  updateLeftPane();
}

export async function sendSyncMessageOnly(
  message: MessageModel,
  {
    targetTimestamp,
    dataMessage,
    saveErrors,
  }: {
    targetTimestamp: number;
    dataMessage: Uint8Array;
    saveErrors?: (errors: Array<Error>) => void;
  }
): Promise<CallbackResultType | void> {
  const conv = window.ConversationController.get(
    message.attributes.conversationId
  );
  message.set({ dataMessage });

  const updateLeftPane = conv?.debouncedUpdateLastMessage;

  try {
    message.set({
      // This is the same as a normal send()
      expirationStartTimestamp: Date.now(),
      errors: [],
    });
    const result = await sendSyncMessage(message, targetTimestamp);
    message.set({
      // We have to do this afterward, since we didn't have a previous send!
      unidentifiedDeliveries:
        result && result.unidentifiedDeliveries
          ? result.unidentifiedDeliveries
          : undefined,
    });
    return result;
  } catch (error) {
    const resultErrors = error?.errors;
    const errors = Array.isArray(resultErrors)
      ? resultErrors
      : [new Error('Unknown error')];
    if (saveErrors) {
      saveErrors(errors);
    } else {
      // We don't save because we're about to save below.
      await saveErrorsOnMessage(message, errors, {
        skipSave: true,
      });
    }
    throw error;
  } finally {
    await window.MessageCache.saveMessage(message.attributes);

    if (updateLeftPane) {
      updateLeftPane();
    }
  }
}

export async function sendSyncMessage(
  message: MessageModel,
  targetTimestamp: number
): Promise<CallbackResultType | void> {
  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  const sendOptions = await getSendOptions(ourConversation.attributes, {
    syncMessage: true,
  });

  if (window.ConversationController.areWePrimaryDevice()) {
    log.warn(
      'sendSyncMessage: We are primary device; not sending sync message'
    );
    message.set({ dataMessage: undefined });
    return;
  }

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('sendSyncMessage: messaging not available!');
  }

  // eslint-disable-next-line no-param-reassign
  message.syncPromise = message.syncPromise || Promise.resolve();
  const next = async () => {
    const dataMessage = message.get('dataMessage');
    if (!dataMessage) {
      return;
    }

    const originalTimestamp = getMessageSentTimestamp(message.attributes, {
      includeEdits: false,
      log,
    });
    const isSendingEdit = targetTimestamp !== originalTimestamp;

    const isUpdate = Boolean(message.get('synced')) && !isSendingEdit;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conv = window.ConversationController.get(
      message.attributes.conversationId
    )!;

    const sendEntries = Object.entries(
      getPropForTimestamp({
        log,
        message: message.attributes,
        prop: 'sendStateByConversationId',
        targetTimestamp,
      }) || {}
    );
    const sentEntries = filter(sendEntries, ([_conversationId, { status }]) =>
      isSent(status)
    );
    const allConversationIdsSentTo = map(
      sentEntries,
      ([conversationId]) => conversationId
    );
    const conversationIdsSentTo = filter(
      allConversationIdsSentTo,
      conversationId => conversationId !== ourConversation.id
    );

    const unidentifiedDeliveries = message.get('unidentifiedDeliveries') || [];
    const maybeConversationsWithSealedSender = map(
      unidentifiedDeliveries,
      identifier => window.ConversationController.get(identifier)
    );
    const conversationsWithSealedSender = filter(
      maybeConversationsWithSealedSender,
      isNotNil
    );
    const conversationIdsWithSealedSender = new Set(
      map(conversationsWithSealedSender, c => c.id)
    );

    const encodedContent = isSendingEdit
      ? {
          encodedEditMessage: dataMessage,
        }
      : {
          encodedDataMessage: dataMessage,
        };

    return handleMessageSend(
      messaging.sendSyncMessage({
        ...encodedContent,
        timestamp: targetTimestamp,
        destinationE164: conv.get('e164'),
        destinationServiceId: conv.getServiceId(),
        expirationStartTimestamp:
          message.get('expirationStartTimestamp') || null,
        conversationIdsSentTo,
        conversationIdsWithSealedSender,
        isUpdate,
        options: sendOptions,
        urgent: false,
      }),
      // Note: in some situations, for doNotSave messages, the message has no
      //   id, so we provide an empty array here.
      { messageIds: message.id ? [message.id] : [], sendType: 'sentSync' }
    ).then(async result => {
      let newSendStateByConversationId: undefined | SendStateByConversationId;
      const sendStateByConversationId =
        getPropForTimestamp({
          log,
          message: message.attributes,
          prop: 'sendStateByConversationId',
          targetTimestamp,
        }) || {};
      const ourOldSendState = getOwn(
        sendStateByConversationId,
        ourConversation.id
      );
      if (ourOldSendState) {
        const ourNewSendState = sendStateReducer(ourOldSendState, {
          type: SendActionType.Sent,
          updatedAt: Date.now(),
        });
        if (ourNewSendState !== ourOldSendState) {
          newSendStateByConversationId = {
            ...sendStateByConversationId,
            [ourConversation.id]: ourNewSendState,
          };
        }
      }

      const attributesForUpdate = newSendStateByConversationId
        ? getChangesForPropAtTimestamp({
            log,
            message: message.attributes,
            prop: 'sendStateByConversationId',
            value: newSendStateByConversationId,
            targetTimestamp,
          })
        : null;

      message.set({
        synced: true,
        dataMessage: null,
        ...attributesForUpdate,
      });

      // Return early, skip the save
      if (message.doNotSave) {
        return result;
      }

      await window.MessageCache.saveMessage(message.attributes);
      return result;
    });
  };

  // eslint-disable-next-line no-param-reassign
  message.syncPromise = message.syncPromise.then(next, next);

  return message.syncPromise;
}
