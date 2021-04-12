// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { LocalizerType } from '../types/Util';
import { AccessControlClass } from '../textsecure.d';

type AccessControlOption = {
  name: string;
  value: number;
};

export function getAccessControlOptions(
  accessEnum: typeof AccessControlClass.AccessRequired,
  i18n: LocalizerType
): Array<AccessControlOption> {
  return [
    {
      name: i18n('GroupV2--all-members'),
      value: accessEnum.MEMBER,
    },
    {
      name: i18n('GroupV2--only-admins'),
      value: accessEnum.ADMINISTRATOR,
    },
  ];
}
