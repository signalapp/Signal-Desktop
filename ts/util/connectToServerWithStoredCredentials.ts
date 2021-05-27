// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIConnectType, WebAPIType } from '../textsecure/WebAPI';

// We define a stricter storage here that returns `unknown` instead of `any`.
type Storage = {
  get(key: string): unknown;
};

export function connectToServerWithStoredCredentials(
  WebAPI: WebAPIConnectType,
  storage: Storage
): WebAPIType {
  const username = storage.get('uuid_id') || storage.get('number_id');
  if (typeof username !== 'string') {
    throw new Error(
      'Username in storage was not a string. Cannot connect to WebAPI'
    );
  }

  const password = storage.get('password');
  if (typeof password !== 'string') {
    throw new Error(
      'Password in storage was not a string. Cannot connect to WebAPI'
    );
  }

  return WebAPI.connect({ username, password });
}
