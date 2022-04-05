// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type UUIDFetchStateKeyType = `${'username' | 'e164'}:${string}`;
export type UUIDFetchStateType = Record<UUIDFetchStateKeyType, boolean>;

export const isFetchingByUsername = (
  fetchState: UUIDFetchStateType,
  username: string
): boolean => {
  return Boolean(fetchState[`username:${username}`]);
};

export const isFetchingByE164 = (
  fetchState: UUIDFetchStateType,
  e164: string
): boolean => {
  return Boolean(fetchState[`e164:${e164}`]);
};
