// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';

export enum RequestState {
  Inactive,
  InactiveWithError,
  Active,
}

export const bemGenerator =
  (block: string) =>
  (element: string, modifier?: string | Record<string, boolean>): string => {
    const base = `${block}__${element}`;
    const classes = [base];

    let conditionals: Record<string, boolean> = {};

    if (modifier) {
      if (typeof modifier === 'string') {
        classes.push(`${base}--${modifier}`);
      } else {
        conditionals = Object.keys(modifier).reduce(
          (acc, key) => ({
            ...acc,
            [`${base}--${key}`]: modifier[key],
          }),
          {} as Record<string, boolean>
        );
      }
    }

    return classNames(classes, conditionals);
  };
