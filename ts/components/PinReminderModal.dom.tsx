// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useState, type JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoPasswordField } from '../axo/fields/AxoPasswordField.dom.tsx';
import {
  InputContainer,
  Spacer,
} from './standaloneRegistration/util/StepComponents.dom.tsx';
import {
  PIN_LENGTH_MINIMUM,
  PIN_MAX_BYTES,
  PIN_MAX_GRAPHEMES,
} from './standaloneRegistration/stages/VerifyPIN.dom.tsx';

export function PinReminderModal({
  i18n,
  internalHasValidationError,
  open,
  onCancel,
  onPinEntry,
}: {
  internalHasValidationError?: boolean;
  i18n: LocalizerType;
  open: boolean;
  onCancel: () => void;
  onPinEntry: (pin: string, ignoreWrongGuess?: boolean) => boolean;
}): JSX.Element {
  const [pin, setPin] = useState('');
  const [isValidPIN, setIsValidPIN] = useState(false);
  const [error, setError] = useState<null | 'pin-incorrect'>(
    internalHasValidationError ? 'pin-incorrect' : null
  );

  const handlePinChange = useCallback(
    (value: string) => {
      setError(null);
      setPin(value);

      const isValid = value.length >= PIN_LENGTH_MINIMUM;
      setIsValidPIN(isValid);

      // Eagerly check the PIN, and if correct then hide the modal.
      if (isValid) {
        onPinEntry(value, true);
      }
    },
    [onPinEntry, setError, setPin]
  );
  const handleSubmit = useCallback(() => {
    const success = onPinEntry(pin);
    setError(success ? null : 'pin-incorrect');
  }, [pin, onPinEntry]);

  const helperElement = error ? (
    <div
      className={tw(
        'ms-1 mt-2 h-6 w-full text-start type-body-small text-destructive'
      )}
    >
      {i18n('icu:PinReminderModal__pin-input-error')}
    </div>
  ) : (
    <Spacer className={tw('h-8')} />
  );

  return (
    <AxoDialog.Root
      open={open}
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

            if (!isValidPIN) {
              return;
            }

            handleSubmit();
          }}
        >
          <AxoDialog.Header>
            <AxoDialog.Title>
              {i18n('icu:PinReminderModal__title')}
            </AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <div className={tw('mb-10 items-center')}>
              <div
                className={tw(
                  'mb-6 text-center type-body-medium text-secondary'
                )}
              >
                {i18n('icu:PinReminderModal__body')}
              </div>
              <InputContainer helperElement={helperElement}>
                <AxoPasswordField.Root
                  placeholder={i18n(
                    'icu:PinReminderModal__pin-input-placeholder'
                  )}
                  autoFocus
                  maxBytes={PIN_MAX_BYTES}
                  maxGraphemes={PIN_MAX_GRAPHEMES}
                  onValueChange={handlePinChange}
                  value={pin}
                  autoComplete="current-password"
                />
              </InputContainer>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="strong-primary"
                onClick={handleSubmit}
                disabled={!isValidPIN}
              >
                {i18n('icu:PinReminderModal__confirm')}
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
