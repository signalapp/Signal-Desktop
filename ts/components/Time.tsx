// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Moment } from 'moment';
import type { ReactElement, TimeHTMLAttributes } from 'react';
import moment from 'moment';
import React from 'react';

import { toBoundedDate } from '../util/timestamp';

export function Time({
  children,
  dateOnly = false,
  timestamp,
  ...otherProps
}: Readonly<
  {
    dateOnly?: boolean;
    timestamp: Readonly<number | Date | Moment>;
  } & Omit<TimeHTMLAttributes<HTMLElement>, 'dateTime'>
>): ReactElement {
  let dateTime: string;
  if (dateOnly) {
    dateTime = moment(timestamp).format('YYYY-MM-DD');
  } else {
    const date =
      typeof timestamp === 'number' ? toBoundedDate(timestamp) : timestamp;
    dateTime = date.toISOString();
  }

  return (
    <time dateTime={dateTime} {...otherProps}>
      {children}
    </time>
  );
}
