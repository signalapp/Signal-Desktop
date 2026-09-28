// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useState, type JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoPasswordField } from '../axo/fields/AxoPasswordField.dom.tsx';
import {
  InputContainer,
  PinLearnMoreLink,
  Spacer,
} from './standaloneRegistration/util/StepComponents.dom.tsx';
import {
  PIN_LENGTH_MINIMUM,
  PIN_MAX_BYTES,
  PIN_MAX_GRAPHEMES,
} from './standaloneRegistration/stages/VerifyPIN.dom.tsx';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { I18n } from './I18n.dom.tsx';

export function PinChangeModal({
  hasSvrPin,
  i18n,
  onCancel,
  onSubmit,
}: {
  hasSvrPin: boolean;
  i18n: LocalizerType;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
}): JSX.Element {
  const [pin, setPin] = useState('');
  const [stagedPin, setStagedPin] = useState('');
  const [isValidPIN, setIsValidPIN] = useState(false);
  const [step, setStep] = useState<'create' | 'confirm'>('create');

  const handlePinInputChange = useCallback(
    (value: string) => {
      setPin(value);

      const isValid =
        value.length >= PIN_LENGTH_MINIMUM &&
        (step === 'confirm' ? value === stagedPin : true);
      setIsValidPIN(isValid);
    },
    [stagedPin, step, setIsValidPIN, setPin]
  );

  const handleCancel = useCallback(() => {
    if (step === 'create') {
      onCancel();
    } else if (step === 'confirm') {
      setPin(stagedPin);
      setStagedPin('');
      setIsValidPIN(true);
      setStep('create');
    } else {
      throw missingCaseError(step);
    }
  }, [stagedPin, step, onCancel, setStep]);

  const handleSubmit = useCallback(() => {
    if (!isValidPIN) {
      return;
    }

    if (step === 'create') {
      setStagedPin(pin);
      setPin('');
      setIsValidPIN(false);
      setStep('confirm');
    } else if (step === 'confirm') {
      onSubmit(pin);
    } else {
      throw missingCaseError(step);
    }
  }, [isValidPIN, pin, step, onSubmit]);

  let title: string;
  let body: JSX.Element;
  if (step === 'create') {
    title = hasSvrPin
      ? i18n('icu:PinChangeModal__title--create')
      : i18n('icu:PinChangeModal__title--create--without-pin');
    const bodyI18n = hasSvrPin
      ? 'icu:PinChangeModal__body--create'
      : 'icu:PinChangeModal__body--create--without-pin';
    body = (
      <I18n
        id={bodyI18n}
        i18n={i18n}
        components={{
          learnMoreLink: PinLearnMoreLink,
        }}
      />
    );
  } else {
    title = i18n('icu:PinChangeModal__title--confirm');
    body = <I18n id="icu:PinChangeModal__body--confirm" i18n={i18n} />;
  }

  return (
    <AxoDialog.Root
      open
      onOpenChange={isOpen => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <AxoDialog.Header>
            {step === 'confirm' && <AxoDialog.Back onClick={handleCancel} />}
            <AxoDialog.Title>{title}</AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <div className={tw('mb-10 items-center')}>
              <div
                className={tw(
                  'mb-6 min-h-9 text-center type-body-medium text-secondary'
                )}
              >
                {body}
              </div>
              <InputContainer helperElement={<Spacer className={tw('h-8')} />}>
                <AxoPasswordField.Root
                  maxBytes={PIN_MAX_BYTES}
                  maxGraphemes={PIN_MAX_GRAPHEMES}
                  onValueChange={handlePinInputChange}
                  value={pin}
                >
                  <AxoPasswordField.Input
                    autoFocus
                    autoComplete="current-password"
                    placeholder={
                      step === 'create'
                        ? i18n(
                            'icu:PinChangeModal__pin-input-placeholder--create'
                          )
                        : i18n(
                            'icu:PinChangeModal__pin-input-placeholder--confirm'
                          )
                    }
                  />
                  <AxoPasswordField.Reveal />
                </AxoPasswordField.Root>
              </InputContainer>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={handleCancel}
              >
                {i18n('icu:PinChangeModal__cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="strong-primary"
                onClick={handleSubmit}
                disabled={!isValidPIN}
              >
                {step === 'create'
                  ? i18n('icu:PinChangeModal__continue')
                  : i18n('icu:PinChangeModal__confirm')}
              </AxoDialog.Action>
              {/* This is used so the Enter key submits the form. */}
              {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label */}
              <button type="submit" hidden />
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </form>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
