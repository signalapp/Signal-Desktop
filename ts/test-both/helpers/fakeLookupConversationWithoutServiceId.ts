// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';

import type {
  UUIDFetchStateType,
  UUIDFetchStateKeyType,
} from '../../util/uuidFetchState';
import type { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId';
import { sleep } from '../../util/sleep';
import * as durations from '../../util/durations';
import type { ConversationType } from '../../state/ducks/conversations';
import { getDefaultConversation } from './getDefaultConversation';

const VALID_IDENTIFIERS = new Set<UUIDFetchStateKeyType>([
  'e164:+12125551234',
  'username:bobross',
]);

export function makeFakeLookupConversationWithoutServiceId(
  saveConversation?: (convo: ConversationType) => void
): typeof lookupConversationWithoutServiceId {
  const cache = new Map<UUIDFetchStateKeyType, ConversationType>();

  return async options => {
    const identifier: UUIDFetchStateKeyType =
      options.type === 'e164'
        ? `e164:${options.e164}`
        : `username:${options.username}`;

    let result = cache.get(identifier);
    if (result) {
      return result.id;
    }

    if (VALID_IDENTIFIERS.has(identifier) && saveConversation) {
      result = getDefaultConversation({
        // We don't really know anything about the contact
        firstName: undefined,
        avatarUrl: undefined,
        name: undefined,
        profileName: undefined,

        ...(options.type === 'e164'
          ? {
              title: options.e164,
              e164: options.e164,
              phoneNumber: options.e164,
            }
          : {
              title: `@${options.username}`,
              username: options.username,
            }),
      });
      cache.set(identifier, result);

      saveConversation(result);
    }

    options.setIsFetchingUUID(identifier, true);

    await sleep(durations.SECOND);

    options.setIsFetchingUUID(identifier, false);

    if (!result) {
      options.showUserNotFoundModal(
        options.type === 'username'
          ? options
          : {
              type: 'phoneNumber',
              phoneNumber: options.phoneNumber,
            }
      );
      return undefined;
    }

    return result.id;
  };
}

type SetIsFetchingUUIDType = (
  identifier: UUIDFetchStateKeyType,
  isFetching: boolean
) => void;

export function useUuidFetchState(
  initial: UUIDFetchStateType = {}
): [UUIDFetchStateType, SetIsFetchingUUIDType] {
  const [uuidFetchState, setUuidFetchState] = useState(initial);

  const setIsFetchingUUID: SetIsFetchingUUIDType = (key, value) => {
    setUuidFetchState(prev => {
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  return [uuidFetchState, setIsFetchingUUID];
}
