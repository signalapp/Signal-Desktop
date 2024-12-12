// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent } from 'react';
import React, { useCallback } from 'react';
import { animated } from '@react-spring/web';
import { Button, ButtonVariant } from './Button';
import type { LocalizerType } from '../types/Util';
import { ModalHost } from './ModalHost';
import { ModalPage } from './Modal';
import type { Theme } from '../util/theme';
import { useAnimated } from '../hooks/useAnimated';
import { Spinner } from './Spinner';

export type ActionSpec = {
  action: () => unknown;
  style?: 'affirmative' | 'negative';
  autoClose?: boolean;
  disabled?: boolean;
  'aria-disabled'?: boolean;
} & (
  | {
      text: string;
      id?: string;
    }
  | {
      text: string | JSX.Element;
      id: string;
    }
);

export type OwnProps = Readonly<{
  actions?: Array<ActionSpec>;
  dialogName: string;
  cancelButtonVariant?: ButtonVariant;
  cancelText?: string;
  isSpinning?: boolean;
  children?: React.ReactNode;
  hasXButton?: boolean;
  i18n: LocalizerType;
  moduleClassName?: string;
  noEscapeClose?: boolean;
  noMouseClose?: boolean;
  noDefaultCancelButton?: boolean;
  onCancel?: () => unknown;
  onClose: () => unknown;
  onTopOfEverything?: boolean;
  theme?: Theme;
  title?: React.ReactNode;
}>;

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

export const ConfirmationDialog = React.memo(function ConfirmationDialogInner({
  actions = [],
  dialogName,
  cancelButtonVariant,
  cancelText,
  children,
  hasXButton,
  i18n,
  isSpinning,
  moduleClassName,
  noEscapeClose,
  noMouseClose,
  noDefaultCancelButton,
  onCancel,
  onClose,
  onTopOfEverything,
  theme,
  title,
}: Props) {
  const { close, overlayStyles, modalStyles } = useAnimated(onClose, {
    getFrom: () => ({ opacity: 0, transform: 'scale(0.25)' }),
    getTo: isOpen => ({ opacity: isOpen ? 1 : 0, transform: 'scale(1)' }),
  });

  const cancelAndClose = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
    close();
  }, [close, onCancel]);

  const handleCancel = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        cancelAndClose();
      }
    },
    [cancelAndClose]
  );

  const hasActions = Boolean(actions.length);

  const footer = (
    <>
      {!isSpinning && !noDefaultCancelButton ? (
        <Button
          onClick={handleCancel}
          ref={focusRef}
          variant={
            cancelButtonVariant ||
            (hasActions ? ButtonVariant.Secondary : ButtonVariant.Primary)
          }
        >
          {cancelText || i18n('icu:confirmation-dialog--Cancel')}
        </Button>
      ) : null}
      {actions.map((action, i) => (
        <Button
          key={
            typeof action.text === 'string'
              ? (action.id ?? action.text)
              : action.id
          }
          disabled={action.disabled || isSpinning}
          aria-disabled={action['aria-disabled']}
          onClick={() => {
            action.action();
            if (action.autoClose !== false) {
              close();
            }
          }}
          data-action={i}
          variant={getButtonVariant(action.style)}
        >
          {isSpinning ? (
            <Spinner
              size="22px"
              svgSize="small"
              direction="on-primary-button"
            />
          ) : (
            action.text
          )}
        </Button>
      ))}
    </>
  );

  const modalName = `ConfirmationDialog.${dialogName}`;

  return (
    <ModalHost
      modalName={modalName}
      noMouseClose={noMouseClose}
      noEscapeClose={noEscapeClose}
      onClose={close}
      onEscape={cancelAndClose}
      onTopOfEverything={onTopOfEverything}
      overlayStyles={overlayStyles}
      theme={theme}
      moduleClassName={
        moduleClassName ? `${moduleClassName}__ModalHost` : undefined
      }
    >
      <animated.div style={modalStyles}>
        <ModalPage
          modalName={modalName}
          hasXButton={hasXButton}
          i18n={i18n}
          moduleClassName={moduleClassName}
          onClose={cancelAndClose}
          title={title}
          modalFooter={footer}
        >
          {children}
        </ModalPage>
      </animated.div>
    </ModalHost>
  );
});
