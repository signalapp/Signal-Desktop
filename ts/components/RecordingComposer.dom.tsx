// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { Button, ButtonSize, ButtonVariant } from './Button.dom.js';

type Props = {
  i18n: LocalizerType;
  children: ReactNode;
  onCancel: () => void;
  onSend: () => void;
};

export function RecordingComposer({
  i18n,
  onCancel,
  onSend,
  children,
}: Props): JSX.Element {
  return (
    <div className="RecordingComposer">
      <div className="RecordingComposer__content">{children}</div>
      <Button
        className="RecordingComposer__button"
        onClick={onCancel}
        size={ButtonSize.Medium}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:RecordingComposer__cancel')}
      </Button>
      <Button
        className="RecordingComposer__button"
        onClick={onSend}
        size={ButtonSize.Medium}
      >
        {i18n('icu:RecordingComposer__send')}
      </Button>
    </div>
  );
}
