// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import moment, { Moment } from 'moment';
import { isLinkPreviewDateValid } from '../../linkPreviews/isLinkPreviewDateValid';

interface Props {
  date: null | number;
  className?: string;
}

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
