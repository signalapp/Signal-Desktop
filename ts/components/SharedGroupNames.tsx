// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import { take } from 'lodash';

import { Emojify } from './conversation/Emojify';
import { Intl } from './Intl';
import type { LocalizerType } from '../types/Util';

type PropsType = {
  i18n: LocalizerType;
  nameClassName?: string;
  sharedGroupNames: Array<string>;
};

export const SharedGroupNames: FunctionComponent<PropsType> = ({
  i18n,
  nameClassName,
  sharedGroupNames,
}) => {
  const firstThreeGroups = take(sharedGroupNames, 3).map((group, i) => (
    // We cannot guarantee uniqueness of group names
    // eslint-disable-next-line react/no-array-index-key
    <strong key={i} className={nameClassName}>
      <Emojify text={group} />
    </strong>
  ));

  if (sharedGroupNames.length >= 5) {
    const remainingCount = sharedGroupNames.length - 3;
    return (
      <Intl
        i18n={i18n}
        id="member-of-more-than-3-groups--multiple-more"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
          group3: firstThreeGroups[2],
          remainingCount: remainingCount.toString(),
        }}
      />
    );
  }
  if (sharedGroupNames.length === 4) {
    return (
      <Intl
        i18n={i18n}
        id="member-of-more-than-3-groups--one-more"
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
      <Intl
        i18n={i18n}
        id="member-of-3-groups"
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
      <Intl
        i18n={i18n}
        id="member-of-2-groups"
        components={{
          group1: firstThreeGroups[0],
          group2: firstThreeGroups[1],
        }}
      />
    );
  }
  if (firstThreeGroups.length >= 1) {
    return (
      <Intl
        i18n={i18n}
        id="member-of-1-group"
        components={{
          group: firstThreeGroups[0],
        }}
      />
    );
  }

  return <>{i18n('no-groups-in-common')}</>;
};
