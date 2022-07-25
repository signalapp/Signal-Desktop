// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';

export function getClassNamesFor(
  ...modules: Array<string | undefined>
): (modifier?: string) => string {
  return modifier => {
    if (modifier === undefined) {
      return '';
    }

    const cx = modules
      .flatMap(m => (m ? m.split(' ') : undefined))
      .map(parentModule =>
        parentModule ? `${parentModule}${modifier}` : undefined
      );

    return classNames(cx);
  };
}
