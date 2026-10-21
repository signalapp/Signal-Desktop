// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { SpinnerV2 } from './SpinnerV2.dom.tsx';

export type ProgressModalProps = Readonly<{
  i18n: LocalizerType;
  description?: string;
}>;

export function ProgressModal(props: ProgressModalProps): ReactNode {
  const { i18n } = props;
  const description = props.description ?? i18n('icu:updating');

  // Note: This dialog cannot be dismissed
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-destructive"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <SpinnerV2 size={58} strokeWidth={4} variant="brand" />
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>{description}</AxoDialog.Title>
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
