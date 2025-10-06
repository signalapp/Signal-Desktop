// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { usernames, LibSignalErrorBase } from '@signalapp/libsignal-client';

import type { UserNotFoundModalStateType } from '../state/ducks/globalModals.js';
import { createLogger } from '../logging/log.js';
import type { AciString } from '../types/ServiceId.js';
import * as Errors from '../types/errors.js';
import { ToastType } from '../types/Toast.js';
import { HTTPError } from '../types/HTTPError.js';
import { strictAssert } from './assert.js';
import type { UUIDFetchStateKeyType } from './uuidFetchState.js';
import { getServiceIdsForE164s } from './getServiceIdsForE164s.js';

const log = createLogger('lookupConversationWithoutServiceId');

export type LookupConversationWithoutServiceIdActionsType = Readonly<{
  lookupConversationWithoutServiceId: typeof lookupConversationWithoutServiceId;
  showUserNotFoundModal: (state: UserNotFoundModalStateType) => void;
  setIsFetchingUUID: (
    identifier: UUIDFetchStateKeyType,
    isFetching: boolean
  ) => void;
}>;

export type LookupConversationWithoutServiceIdOptionsType = Omit<
  LookupConversationWithoutServiceIdActionsType,
  'lookupConversationWithoutServiceId'
> &
  Readonly<
    | {
        type: 'e164';
        e164: string;
        phoneNumber: string;
      }
    | {
        type: 'username';
        username: string;
      }
  >;

type FoundUsernameType = {
  aci: AciString;
  username: string;
};

export async function lookupConversationWithoutServiceId(
  options: LookupConversationWithoutServiceIdOptionsType
): Promise<string | undefined> {
  if (options.type === 'username') {
    const knownConversation = window.ConversationController.get(
      options.username
    );
    if (knownConversation && knownConversation.getServiceId()) {
      return knownConversation.id;
    }
  }

  const identifier: UUIDFetchStateKeyType =
    options.type === 'e164'
      ? `e164:${options.e164}`
      : `username:${options.username}`;

  const { showUserNotFoundModal, setIsFetchingUUID } = options;
  setIsFetchingUUID(identifier, true);

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server is not available!');
  }

  try {
    let conversationId: string | undefined;
    if (options.type === 'e164') {
      const { entries: serverLookup, transformedE164s } =
        await getServiceIdsForE164s(server, [options.e164]);
      const e164ToUse = transformedE164s.get(options.e164) ?? options.e164;

      const maybePair = serverLookup.get(e164ToUse);

      if (maybePair) {
        const { conversation } =
          window.ConversationController.maybeMergeContacts({
            aci: maybePair.aci,
            pni: maybePair.pni,
            e164: e164ToUse,
            reason: 'startNewConversationWithoutUuid(e164)',
          });
        conversationId = conversation?.id;
      }
    } else {
      const foundUsername = await checkForUsername(options.username);
      if (foundUsername) {
        const convo = window.ConversationController.lookupOrCreate({
          serviceId: foundUsername.aci,
          reason: 'lookupConversationWithoutServiceId',
        });

        strictAssert(convo, 'We just ensured conversation existence');

        conversationId = convo.id;

        await convo.updateUsername(foundUsername.username);
      }
    }

    if (!conversationId) {
      showUserNotFoundModal(
        options.type === 'username'
          ? options
          : {
              type: 'phoneNumber',
              phoneNumber: options.phoneNumber,
            }
      );
      return undefined;
    }

    return conversationId;
  } catch (error) {
    log.error(
      'startNewConversationWithoutUuid: Something went wrong fetching:',
      Errors.toLogFormat(error)
    );

    if (options.type === 'e164') {
      window.reduxActions.toast.showToast({
        toastType: ToastType.FailedToFetchPhoneNumber,
      });
    } else {
      window.reduxActions.toast.showToast({
        toastType: ToastType.FailedToFetchUsername,
      });
    }

    return undefined;
  } finally {
    setIsFetchingUUID(identifier, false);
  }
}

export async function checkForUsername(
  username: string
): Promise<FoundUsernameType | undefined> {
  let hash: Uint8Array;
  let fixedUsername = username;
  if (fixedUsername.startsWith('@')) {
    fixedUsername = fixedUsername.slice(1);
  }

  try {
    hash = usernames.hash(fixedUsername);
  } catch (error) {
    log.error('checkForUsername: invalid username', Errors.toLogFormat(error));
    return undefined;
  }

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server is not available!');
  }

  try {
    const account = await server.getAccountForUsername({
      hash,
    });

    if (!account.uuid) {
      log.error("checkForUsername: Returned account didn't include a uuid");
      return;
    }

    return {
      aci: account.uuid,
      username: fixedUsername,
    };
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.code === 404) {
        return undefined;
      }
    }

    // Invalid username
    if (error instanceof LibSignalErrorBase) {
      log.error('checkForUsername: invalid username');
      return undefined;
    }

    throw error;
  }
}
