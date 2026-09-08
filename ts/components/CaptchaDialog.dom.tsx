// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState, type JSX, type MouseEvent } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type CaptchaDialogProps = Readonly<{
  i18n: LocalizerType;
  pending: boolean;
  onContinue: () => void;
  onSkip: () => void;
}>;

export function CaptchaDialog(props: CaptchaDialogProps): JSX.Element {
  const { i18n, onContinue } = props;
  const [closing, setClosing] = useState(false);

  const handleContinue = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      onContinue();
    },
    [onContinue]
  );

  if (closing) {
    return (
      <AxoConfirmDialog.Root
        title={i18n('icu:CaptchaDialog--can-close__title')}
        description={<p>{i18n('icu:CaptchaDialog--can-close__body')}</p>}
        open
        onOpenChange={() => setClosing(false)}
        key="skip"
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={props.onSkip}
        >
          {i18n('icu:CaptchaDialog--can_close__skip-verification')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    );
  }

  return (
    <AxoConfirmDialog.Root
      title={i18n('icu:CaptchaDialog__title')}
      description={
        <>
          <p>{i18n('icu:CaptchaDialog__first-paragraph')}</p>
          <p>{i18n('icu:CaptchaDialog__second-paragraph')}</p>
        </>
      }
      open
      onOpenChange={() => setClosing(true)}
      escape="cancel-is-noop"
    >
      <AxoConfirmDialog.Cancel>
        {i18n('icu:CaptchaDialog--can_close__skip-verification')}
      </AxoConfirmDialog.Cancel>
      <AxoConfirmDialog.Action
        variant="strong-primary"
        pending={props.pending}
        onClick={handleContinue}
        autoFocus
      >
        {i18n('icu:CaptchaDialog__continue')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
