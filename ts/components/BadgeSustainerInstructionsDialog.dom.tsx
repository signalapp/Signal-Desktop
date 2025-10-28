// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';

export function BadgeSustainerInstructionsDialog({
  i18n,
  onClose,
}: Readonly<{ i18n: LocalizerType; onClose: () => unknown }>): ReactElement {
  return (
    <Modal
      modalName="BadgeSustainerInstructionsDialog"
      hasXButton
      moduleClassName="BadgeSustainerInstructionsDialog"
      i18n={i18n}
      onClose={onClose}
    >
      <h1 className="BadgeSustainerInstructionsDialog__header">
        {i18n('icu:BadgeSustainerInstructions__header')}
      </h1>
      <h2 className="BadgeSustainerInstructionsDialog__subheader">
        {i18n('icu:BadgeSustainerInstructions__subheader')}
      </h2>
      <ol className="BadgeSustainerInstructionsDialog__instructions">
        <li>{i18n('icu:BadgeSustainerInstructions__instructions__1')}</li>
        <li>{i18n('icu:BadgeSustainerInstructions__instructions__2')}</li>
        <li>{i18n('icu:BadgeSustainerInstructions__instructions__3')}</li>
      </ol>
    </Modal>
  );
}
