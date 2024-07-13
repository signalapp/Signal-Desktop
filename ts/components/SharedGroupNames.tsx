// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { take } from 'lodash';

import { I18n } from './I18n';
import type { LocalizerType } from '../types/Util';
import { UserText } from './UserText';

type PropsType = {
  i18n: LocalizerType;
  nameClassName?: string;
  sharedGroupNames: ReadonlyArray<string>;
};

export function SharedGroupNames({
  i18n,
  nameClassName,
  sharedGroupNames,
}: PropsType): JSX.Element {
  const firstThreeGroups = take(sharedGroupNames, 3).map((group, i) => (
    // We cannot guarantee uniqueness of group names
    // eslint-disable-next-line react/no-array-index-key
    <strong key={i} className={nameClassName}>
      <UserText text={group} />
    </strong>
  ));

  if (sharedGroupNames.length >= 5) {
    const remainingCount = sharedGroupNames.length - 3;
    return (
      <I18n
        i18n={i18n}
        id="icu:member-of-more-than-3-groups--multiple-more"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
          group3: firstThreeGroups[2],
          remainingCount,
        }}
      />
    );
  }
  if (sharedGroupNames.length === 4) {
    return (
      <I18n
        i18n={i18n}
        id="icu:member-of-more-than-3-groups--one-more"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
          group3: firstThreeGroups[2],
        }}
      />
    );
  }
  if (firstThreeGroups.length === 3) {
    return (
      <I18n
        i18n={i18n}
        id="icu:member-of-3-groups"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
          group3: firstThreeGroups[2],
        }}
      />
    );
  }
  if (firstThreeGroups.length >= 2) {
    return (
      <I18n
        i18n={i18n}
        id="icu:member-of-2-groups"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
        }}
      />
    );
  }
  if (firstThreeGroups.length >= 1) {
    return (
      <I18n
        i18n={i18n}
        id="icu:member-of-1-group"
        components={{
          group: firstThreeGroups[0],
        }}
      />
    );
  }

  return <>{i18n('icu:no-groups-in-common')}</>;
}
