// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const isInSystemContacts = ({
  type,
  name,
}: Readonly<{
  type?: string;
  name?: string;
}>): boolean =>
  // `direct` for redux, `private` for models and the database
  (type === 'direct' || type === 'private') && typeof name === 'string';
