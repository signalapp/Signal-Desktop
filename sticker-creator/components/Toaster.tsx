// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { last, noop } from 'lodash';
import { Toast } from '../elements/Toast';

export type Props = React.HTMLAttributes<HTMLDivElement> & {
  loaf: Array<{ id: number; text: string }>;
  onDismiss: () => unknown;
};

const DEFAULT_DISMISS = 1e4;

export const Toaster = React.memo(({ loaf, onDismiss, className }: Props) => {
  const slice = last(loaf);

  React.useEffect(() => {
    if (!slice) {
      return noop;
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, DEFAULT_DISMISS);

    return () => {
      clearTimeout(timer);
    };
  }, [slice, onDismiss]);

  if (!slice) {
    return null;
  }

  return (
    <div className={className}>
      <Toast key={slice.id} onClick={onDismiss} tabIndex={0}>
        {slice.text}
      </Toast>
    </div>
  );
});
