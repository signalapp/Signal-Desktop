// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useId, useState, type JSX } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.tsx';
import { I18n } from './I18n.dom.tsx';

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
): JSX.Element {
  const { i18n, open, onOpenChange, onViewDebugLog, onSubmit, isSubmitting } =
    props;

  const debugLogCheckboxId = useId();
  const [shareDebugLog, setShareDebugLog] = useState(false);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    onSubmit(shareDebugLog);
  }, [onSubmit, shareDebugLog]);

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content escape="cancel-is-noop" size="md">
        <AxoDialog.Body>
          <AxoDialog.Title>
            {i18n('icu:KeyTransparencyErrorDialog__Title-v2')}
          </AxoDialog.Title>

          <AxoDialog.Description>
            <p className={tw('mb-2.5')}>
              <I18n
                i18n={i18n}
                id="icu:KeyTransparencyErrorDialog__Description-v2"
              />
            </p>
          </AxoDialog.Description>

          <div className={tw('flex items-center gap-3')}>
            <AxoCheckbox.Root
              variant="square"
              id={debugLogCheckboxId}
              checked={shareDebugLog}
              onCheckedChange={setShareDebugLog}
            />
            <label
              htmlFor={debugLogCheckboxId}
              className={tw('grow truncate text-primary')}
            >
              {i18n('icu:KeyTransparencyErrorDialog__ShareDebugLog__Label-v2')}
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
            <AxoDialog.Action variant="subtle-secondary" onClick={handleCancel}>
              {i18n('icu:KeyTransparencyErrorDialog__Cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              arrow="external-link"
              onClick={handleSubmit}
              pending={isSubmitting}
            >
              {i18n('icu:KeyTransparencyErrorDialog__Submit')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
