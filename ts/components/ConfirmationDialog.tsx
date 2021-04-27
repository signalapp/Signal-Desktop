// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { Button, ButtonVariant } from './Button';
import { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Theme } from '../util/theme';

export type ActionSpec = {
  text: string;
  action: () => unknown;
  style?: 'affirmative' | 'negative';
};

export type OwnProps = {
  readonly actions?: Array<ActionSpec>;
  readonly cancelText?: string;
  readonly children?: React.ReactNode;
  readonly i18n: LocalizerType;
  readonly onCancel?: () => unknown;
  readonly onClose: () => unknown;
  readonly title?: string | React.ReactNode;
  readonly theme?: Theme;
};

export type Props = OwnProps;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

function getButtonVariant(
  buttonStyle?: 'affirmative' | 'negative'
): ButtonVariant {
  if (buttonStyle === 'affirmative') {
    return ButtonVariant.Primary;
  }

  if (buttonStyle === 'negative') {
    return ButtonVariant.Destructive;
  }

  return ButtonVariant.Secondary;
}

export const ConfirmationDialog = React.memo(
  ({
    actions = [],
    cancelText,
    children,
    i18n,
    onCancel,
    onClose,
    theme,
    title,
  }: Props) => {
    const cancelAndClose = React.useCallback(() => {
      if (onCancel) {
        onCancel();
      }
      onClose();
    }, [onCancel, onClose]);

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          cancelAndClose();
        }
      },
      [cancelAndClose]
    );

    const hasActions = Boolean(actions.length);

    return (
      <Modal i18n={i18n} onClose={cancelAndClose} title={title} theme={theme}>
        {children}
        <Modal.Footer>
          <Button
            onClick={handleCancel}
            ref={focusRef}
            variant={
              hasActions ? ButtonVariant.Secondary : ButtonVariant.Primary
            }
          >
            {cancelText || i18n('confirmation-dialog--Cancel')}
          </Button>
          {actions.map((action, i) => (
            <Button
              key={action.text}
              onClick={() => {
                action.action();
                onClose();
              }}
              data-action={i}
              variant={getButtonVariant(action.style)}
            >
              {action.text}
            </Button>
          ))}
        </Modal.Footer>
      </Modal>
    );
  }
);
