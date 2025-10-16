// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { Spinner } from './Spinner.dom.js';

export type PropsType = {
  readonly i18n: LocalizerType;
};

// TODO: This should use <Modal>. See DESKTOP-1038.
export const ProgressDialog = React.memo(function ProgressDialogInner({
  i18n,
}: PropsType) {
  return (
    <div className="module-progress-dialog">
      <div className="module-progress-dialog__spinner">
        <Spinner svgSize="normal" size="39px" direction="on-progress-dialog" />
      </div>
      <div className="module-progress-dialog__text">{i18n('icu:updating')}</div>
    </div>
  );
});
