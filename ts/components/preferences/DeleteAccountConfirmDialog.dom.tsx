// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PhoneNumberFormat } from 'google-libphonenumber';

import { tw } from '../../axo/tw.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { AxoFieldList } from '../../axo/items/AxoFieldList.dom.tsx';
import { AxoTextField } from '../../axo/fields/AxoTextField.dom.tsx';
import { parseNumber } from '../../util/libphonenumberUtil.std.ts';
import { parseAndFormatPhoneNumber } from '../../util/libphonenumberInstance.std.ts';

import type { LocalizerType } from '../../types/I18N.std.ts';

type Props = {
  e164: string;
  i18n: LocalizerType;
  onDelete: () => unknown;
  open: boolean;
  setClosed: () => unknown;
};

function removeNonDigits(value: string): string {
  return value.replaceAll(/\D/g, '');
}

export function DeleteAccountConfirmDialog({
  e164,
  i18n,
  onDelete,
  open,
  setClosed,
}: Props): ReactNode {
  const e164Info = useMemo(() => {
    const parsed = parseNumber(e164);
    if (!parsed.isValidNumber) {
      return undefined;
    }

    const { countryCode, regionCode } = parsed;
    if (!countryCode || !regionCode) {
      return undefined;
    }

    return {
      countryCode: `+${countryCode}`,
      nationalNumber: parseAndFormatPhoneNumber(
        e164,
        regionCode,
        PhoneNumberFormat.NATIONAL
      )?.e164,
    };
  }, [e164]);

  const [countryCode, setCountryCode] = useState(e164Info?.countryCode ?? '');
  const [enteredPhoneNumber, setEnteredPhoneNumber] = useState('');

  const isValid = useMemo(() => {
    const cleanPhoneNumber = removeNonDigits(enteredPhoneNumber);
    const cleanCountryCode = removeNonDigits(countryCode);

    if (e164Info?.nationalNumber) {
      if (
        cleanPhoneNumber.length > 0 &&
        cleanPhoneNumber === removeNonDigits(e164Info.nationalNumber) &&
        cleanCountryCode === removeNonDigits(e164Info.countryCode)
      ) {
        return true;
      }
    }

    const potentialE164 = `+${cleanPhoneNumber}`;
    const potentialCombinedE164 = `+${cleanCountryCode}${cleanPhoneNumber}`;

    return potentialE164 === e164 || potentialCombinedE164 === e164;
  }, [countryCode, e164, e164Info, enteredPhoneNumber]);

  const disabled = !isValid;
  const handleSubmit = useCallback(() => {
    if (disabled) {
      return;
    }

    // Make the user enter this stuff again if they cancel out on the next dialog
    setEnteredPhoneNumber('');
    setCountryCode(e164Info?.countryCode ?? '');

    onDelete();
  }, [disabled, onDelete, setCountryCode, setEnteredPhoneNumber, e164Info]);

  const handleClose = useCallback(() => {
    // We need to reset everything in this dialog, because it stays mounted when not open
    setEnteredPhoneNumber('');
    setCountryCode(e164Info?.countryCode ?? '');

    setClosed();
  }, [setClosed, setCountryCode, setEnteredPhoneNumber, e164Info]);

  return (
    <AxoDialog.Root
      open={open}
      onOpenChange={newOpen => {
        if (!newOpen) {
          handleClose();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:DeleteAccountConfirmDialog--Title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div
            className={tw(
              'm-auto w-15 rounded-full bg-destructive-tint text-center text-destructive'
            )}
          >
            <AxoSymbol.Icon size={60} symbol="error-circle" label={null} />
          </div>
          <div
            className={tw(
              'm-auto mt-5 mb-4 max-w-78 text-center type-body-large'
            )}
          >
            {i18n('icu:DeleteAccountConfirmDialog--Description')}
          </div>
          <div className={tw('mb-7')}>
            <AxoFieldList.Root
              title={i18n('icu:DeleteAccountConfirmDialog--ConfirmNumber')}
            >
              <AxoFieldList.Item>
                <form
                  className={tw('max-w-full')}
                  onSubmit={event => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <AxoTextField.Root
                    value={countryCode}
                    onValueChange={setCountryCode}
                    maxGraphemes={26}
                    maxBytes={128}
                  >
                    <AxoTextField.Input
                      placeholder={i18n(
                        'icu:DeleteAccountConfirmDialog--CountryCodePlaceholder'
                      )}
                    />
                  </AxoTextField.Root>
                </form>
              </AxoFieldList.Item>
              <AxoFieldList.Item>
                <form
                  className={tw('max-w-full')}
                  onSubmit={event => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <AxoTextField.Root
                    value={enteredPhoneNumber}
                    onValueChange={setEnteredPhoneNumber}
                    maxGraphemes={26}
                    maxBytes={128}
                  >
                    <AxoTextField.Input
                      placeholder={i18n(
                        'icu:DeleteAccountConfirmDialog--NumberPlaceholder'
                      )}
                    />
                  </AxoTextField.Root>
                </form>
              </AxoFieldList.Item>
            </AxoFieldList.Root>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={handleClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-destructive"
              disabled={disabled}
              onClick={handleSubmit}
            >
              {i18n('icu:DeleteAccountConfirmDialog--DeleteButton')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
