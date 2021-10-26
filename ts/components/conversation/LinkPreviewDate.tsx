// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Moment } from 'moment';
import moment from 'moment';
import { isLinkPreviewDateValid } from '../../linkPreviews/isLinkPreviewDateValid';

type Props = {
  date?: null | number;
  className?: string;
};

export const LinkPreviewDate: React.FC<Props> = ({
  date,
  className = '',
}: Props) => {
  const dateMoment: Moment | null = isLinkPreviewDateValid(date)
    ? moment(date)
    : null;

  return dateMoment ? (
    <time className={className} dateTime={dateMoment.toISOString()}>
      {dateMoment.format('ll')}
    </time>
  ) : null;
};
