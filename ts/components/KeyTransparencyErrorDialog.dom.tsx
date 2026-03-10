// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useId, useState } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { tw } from '../axo/tw.dom.js';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.js';
import { I18n } from './I18n.dom.js';

export type KeyTransparencyErrorDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (shareDebugLog: boolean) => void;
  onViewDebugLog: () => void;
  isSubmitting: boolean;
}>;

export function KeyTransparencyErrorDialog(
  props: KeyTransparencyErrorDialogProps
): React.JSX.Element {
  const { i18n, open, onOpenChange, onViewDebugLog, onSubmit, isSubmitting } =
    props;

  const debugLogCheckboxId = useId();
  const [shareDebugLog, setShareDebugLog] = useState(false);

  const handleSubmit = useCallback(() => {
    onSubmit(shareDebugLog);
  }, [onSubmit, shareDebugLog]);

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content escape="cancel-is-noop" size="md">
        <AxoDialog.Body>
          <h3 className={tw('mt-6 mb-2 type-title-small')}>
            {i18n('icu:KeyTransparencyErrorDialog__Title')}
          </h3>
          <p className={tw('mb-3 type-body-medium text-label-primary')}>
            <AxoDialog.Description>
              <I18n
                i18n={i18n}
                id="icu:KeyTransparencyErrorDialog__Description"
              />
            </AxoDialog.Description>
          </p>
          <div className={tw('mt-1.5 mb-4.5 flex items-center gap-3')}>
            <AxoCheckbox.Root
              variant="square"
              id={debugLogCheckboxId}
              checked={shareDebugLog}
              onCheckedChange={setShareDebugLog}
            />
            <label htmlFor={debugLogCheckboxId} className={tw('grow truncate')}>
              {i18n('icu:KeyTransparencyErrorDialog__ShareDebugLog__Label')}
            </label>
            <AxoButton.Root
              variant="subtle-primary"
              size="sm"
              onClick={onViewDebugLog}
            >
              {i18n(
                'icu:KeyTransparencyErrorDialog__ShareDebugLog__ViewButton'
              )}
            </AxoButton.Root>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="primary"
              onClick={handleSubmit}
              experimentalSpinner={
                isSubmitting
                  ? {
                      'aria-label': i18n(
                        'icu:KeyTransparencyErrorDialog__Submitting'
                      ),
                    }
                  : null
              }
            >
              {i18n('icu:KeyTransparencyErrorDialog__Submit')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
