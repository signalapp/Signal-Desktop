// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';

const AccessControlEnum = Proto.AccessControl.AccessRequired;

type AccessControlOption = {
  text: string;
  value: number;
};

export function getAccessControlOptions(
  i18n: LocalizerType
): Array<AccessControlOption> {
  return [
    {
      text: i18n('icu:GroupV2--all-members'),
      value: AccessControlEnum.MEMBER,
    },
    {
      text: i18n('icu:GroupV2--only-admins'),
      value: AccessControlEnum.ADMINISTRATOR,
    },
  ];
}
