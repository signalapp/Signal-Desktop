// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRoot, type Root } from 'react-dom/client';
import { AppProvider } from '../windows/AppProvider.dom.tsx';
// oxlint-disable-next-line signal-desktop/no-restricted-paths
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

type ConfirmationDialogViewProps = {
  cancelText?: string;
  confirmStyle?: 'primary' | 'destructive';
  title: string;
  description: string;
  okText: string;
  reject?: (error: Error) => void;
  resolve: () => void;
};

let confirmationDialogRoot: Root | undefined;
let confirmationDialogPreviousFocus: HTMLElement | undefined;

function removeConfirmationDialog() {
  if (!confirmationDialogRoot) {
    return;
  }

  window.reduxActions?.globalModals.toggleConfirmationModal(false);

  confirmationDialogRoot.unmount();

  if (
    confirmationDialogPreviousFocus &&
    typeof confirmationDialogPreviousFocus.focus === 'function'
  ) {
    confirmationDialogPreviousFocus.focus();
  }
  confirmationDialogRoot = undefined;
}

export function showConfirmationDialog(
  options: ConfirmationDialogViewProps
): void {
  const { i18n } = window.SignalContext;

  if (confirmationDialogRoot) {
    removeConfirmationDialog();
  }

  window.reduxActions?.globalModals.toggleConfirmationModal(true);

  const confirmationDialogViewNode = document.createElement('div');
  document.body.appendChild(confirmationDialogViewNode);

  confirmationDialogPreviousFocus = document.activeElement as HTMLElement;

  confirmationDialogRoot = createRoot(confirmationDialogViewNode);
  confirmationDialogRoot.render(
    <AppProvider>
      <AxoConfirmDialog.Root
        open
        onOpenChange={removeConfirmationDialog}
        title={options.title}
        description={options.description}
      >
        <AxoConfirmDialog.Action
          variant="secondary"
          onClick={() => {
            options.reject?.(
              new Error('showConfirmationDialog: onCancel called')
            );
          }}
        >
          {options.cancelText ?? i18n('icu:cancel')}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant={options.confirmStyle ?? 'primary'}
          onClick={options.resolve}
        >
          {options.okText || i18n('icu:ok')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </AppProvider>
  );
}
