// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { WidthBreakpoint } from './_util.std.ts';

import { LeftPaneDialog } from './LeftPaneDialog.dom.tsx';
import {
  DeleteDataAndRelinkConfirmationDialog,
  MaybeTransferModal,
} from './MaybeTransferModal.dom.tsx';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
  relinkDevice: () => void;
  renderClearingDataView: () => void;
  reregister: () => void;
  weArePrimaryDevice: boolean;
};

export function DialogRelink({
  containerWidthBreakpoint,
  i18n,
  relinkDevice,
  renderClearingDataView,
  reregister,
  weArePrimaryDevice,
}: PropsType): JSX.Element | null {
  const [relinkDialogStep, setRelinkDialogStep] = useState<
    'maybe-transfer' | 'confirm-deletion' | null
  >(null);

  if (weArePrimaryDevice) {
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        icon="relink"
        clickLabel={i18n('icu:unregisteredWarning')}
        onClick={reregister}
        title={i18n('icu:unregistered')}
        hasAction
      />
    );
  }

  return (
    <>
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        icon="relink"
        clickLabel={i18n('icu:unlinkedWarning')}
        onClick={() => setRelinkDialogStep('maybe-transfer')}
        title={i18n('icu:unlinked')}
        hasAction
      />
      <MaybeTransferModal
        open={relinkDialogStep === 'maybe-transfer'}
        i18n={i18n}
        onTransfer={() => setRelinkDialogStep('confirm-deletion')}
        onDontTransfer={relinkDevice}
        onCancel={() => setRelinkDialogStep(null)}
      />
      {relinkDialogStep === 'confirm-deletion' ? (
        <DeleteDataAndRelinkConfirmationDialog
          open={relinkDialogStep === 'confirm-deletion'}
          i18n={i18n}
          onCancel={() => setRelinkDialogStep('maybe-transfer')}
          onConfirm={() => {
            renderClearingDataView();
            setRelinkDialogStep(null);
          }}
        />
      ) : null}
    </>
  );
}
