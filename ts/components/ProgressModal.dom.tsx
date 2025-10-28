// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ProgressDialog } from './ProgressDialog.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

export type PropsType = {
  readonly i18n: LocalizerType;
};

export const ProgressModal = React.memo(function ProgressModalInner({
  i18n,
}: PropsType) {
  const [root, setRoot] = React.useState<HTMLElement | null>(null);

  // Note: We explicitly don't register for user interaction here, since this dialog
  //   cannot be dismissed.

  React.useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setRoot(div);

    return () => {
      document.body.removeChild(div);
      setRoot(null);
    };
  }, []);

  return root
    ? createPortal(
        <div role="presentation" className="module-progress-dialog__overlay">
          <ProgressDialog i18n={i18n} />
        </div>,
        root
      )
    : null;
});
