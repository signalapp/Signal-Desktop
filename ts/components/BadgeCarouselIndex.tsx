// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { times } from 'lodash';

import { strictAssert } from '../util/assert';

export function BadgeCarouselIndex({
  currentIndex,
  totalCount,
}: Readonly<{
  currentIndex: number;
  totalCount: number;
}>): JSX.Element | null {
  strictAssert(totalCount >= 1, 'Expected 1 or more items');
  strictAssert(
    currentIndex < totalCount,
    'Expected current index to be in range'
  );

  if (totalCount < 2) {
    return null;
  }

  return (
    <div aria-hidden className="BadgeCarouselIndex">
      {times(totalCount, index => (
        <div
          key={index}
          className={classNames(
            'BadgeCarouselIndex__dot',
            currentIndex === index && 'BadgeCarouselIndex__dot--selected'
          )}
        />
      ))}
    </div>
  );
}
