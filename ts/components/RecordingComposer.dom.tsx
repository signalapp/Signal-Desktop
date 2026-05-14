// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

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
      <AxoButton.Root
        variant="borderless-secondary"
        size="md"
        onClick={onCancel}
      >
        {i18n('icu:RecordingComposer__cancel')}
      </AxoButton.Root>
      <AxoButton.Root variant="primary" size="md" onClick={onSend}>
        {i18n('icu:RecordingComposer__send')}
      </AxoButton.Root>
    </div>
  );
}
