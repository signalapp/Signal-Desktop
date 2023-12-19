// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const isInSystemContacts = ({
  type,
  name,
  systemGivenName,
  systemFamilyName,
}: Readonly<{
  type?: string;
  name?: string;
  systemGivenName?: string;
  systemFamilyName?: string;
}>): boolean =>
  // `direct` for redux, `private` for models and the database
  (type === 'direct' || type === 'private') &&
  (typeof name === 'string' ||
    typeof systemGivenName === 'string' ||
    typeof systemFamilyName === 'string');
