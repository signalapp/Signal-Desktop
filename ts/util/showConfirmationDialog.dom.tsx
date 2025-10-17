// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
// eslint-disable-next-line import/no-restricted-paths
import { ConfirmationDialog } from '../components/ConfirmationDialog.dom.js';
// eslint-disable-next-line import/no-restricted-paths
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider.dom.js';
// eslint-disable-next-line import/no-restricted-paths
import { AxoProvider } from '../axo/AxoProvider.dom.js';

type ConfirmationDialogViewProps = {
  onTopOfEverything?: boolean;
  dialogName: string;
  cancelText?: string;
  confirmStyle?: 'affirmative' | 'negative';
  title: string;
  description?: string;
  okText: string;
  noMouseClose?: boolean;
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
    <StrictMode>
      <AxoProvider dir={i18n.getLocaleDirection()}>
        <FunDefaultEnglishEmojiLocalizationProvider>
          <ConfirmationDialog
            dialogName={options.dialogName}
            onTopOfEverything={options.onTopOfEverything}
            actions={[
              {
                action: () => {
                  options.resolve();
                },
                style: options.confirmStyle,
                text: options.okText || i18n('icu:ok'),
              },
            ]}
            cancelText={options.cancelText || i18n('icu:cancel')}
            i18n={i18n}
            onCancel={() => {
              if (options.reject) {
                options.reject(
                  new Error('showConfirmationDialog: onCancel called')
                );
              }
            }}
            onClose={() => {
              removeConfirmationDialog();
            }}
            title={options.title}
            noMouseClose={options.noMouseClose}
          >
            {options.description}
          </ConfirmationDialog>
        </FunDefaultEnglishEmojiLocalizationProvider>
      </AxoProvider>
    </StrictMode>
  );
}
