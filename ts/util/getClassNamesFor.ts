// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';

export function getClassNamesFor(
  ...modules: Array<string | undefined>
): (modifier?: string) => string {
  return modifier => {
    const cx = modules.map(parentModule =>
      parentModule && modifier !== undefined
        ? `${parentModule}${modifier}`
        : undefined
    );
    return classNames(cx);
  };
}
