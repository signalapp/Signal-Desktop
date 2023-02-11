// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { usernames } from '@signalapp/libsignal-client';

import { ToastFailedToFetchUsername } from '../components/ToastFailedToFetchUsername';
import { ToastFailedToFetchPhoneNumber } from '../components/ToastFailedToFetchPhoneNumber';
import type { UserNotFoundModalStateType } from '../state/ducks/globalModals';
import * as log from '../logging/log';
import { UUID } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import * as Errors from '../types/errors';
import { HTTPError } from '../textsecure/Errors';
import { showToast } from './showToast';
import { strictAssert } from './assert';
import type { UUIDFetchStateKeyType } from './uuidFetchState';
import { getUuidsForE164s } from './getUuidsForE164s';
import { isValidUsername } from './Username';

export type LookupConversationWithoutUuidActionsType = Readonly<{
  lookupConversationWithoutUuid: typeof lookupConversationWithoutUuid;
  showUserNotFoundModal: (state: UserNotFoundModalStateType) => void;
  setIsFetchingUUID: (
    identifier: UUIDFetchStateKeyType,
    isFetching: boolean
  ) => void;
}>;

export type LookupConversationWithoutUuidOptionsType = Omit<
  LookupConversationWithoutUuidActionsType,
  'lookupConversationWithoutUuid'
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
  uuid: UUIDStringType;
  username: string;
};

export async function lookupConversationWithoutUuid(
  options: LookupConversationWithoutUuidOptionsType
): Promise<string | undefined> {
  const knownConversation = window.ConversationController.get(
    options.type === 'e164' ? options.e164 : options.username
  );
  if (knownConversation && knownConversation.get('uuid')) {
    return knownConversation.id;
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
      const serverLookup = await getUuidsForE164s(server, [options.e164]);

      const maybePair = serverLookup.get(options.e164);

      if (maybePair) {
        const { conversation } =
          window.ConversationController.maybeMergeContacts({
            aci: maybePair.aci,
            pni: maybePair.pni,
            e164: options.e164,
            reason: 'startNewConversationWithoutUuid(e164)',
          });
        conversationId = conversation?.id;
      }
    } else {
      const foundUsername = await checkForUsername(options.username);
      if (foundUsername) {
        const convo = window.ConversationController.lookupOrCreate({
          uuid: foundUsername.uuid,
          reason: 'lookupConversationWithoutUuid',
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
      showToast(ToastFailedToFetchPhoneNumber);
    } else {
      showToast(ToastFailedToFetchUsername);
    }

    return undefined;
  } finally {
    setIsFetchingUUID(identifier, false);
  }
}

async function checkForUsername(
  username: string
): Promise<FoundUsernameType | undefined> {
  if (!isValidUsername(username)) {
    return undefined;
  }

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server is not available!');
  }

  try {
    const account = await server.getAccountForUsername({
      hash: usernames.hash(username),
    });

    if (!account.uuid) {
      log.error("checkForUsername: Returned account didn't include a uuid");
      return;
    }

    return {
      uuid: UUID.cast(account.uuid),
      username,
    };
  } catch (error) {
    if (!(error instanceof HTTPError)) {
      throw error;
    }

    if (error.code === 404) {
      return undefined;
    }

    throw error;
  }
}
