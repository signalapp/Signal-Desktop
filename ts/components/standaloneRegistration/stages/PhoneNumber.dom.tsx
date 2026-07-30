// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';

import type { JSX } from 'react';

import { parseNumber } from '../../../util/libphonenumberUtil.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { ConfirmPhoneNumberDialog } from '../util/ConfirmPhoneNumberDialog.dom.tsx';
import { ChooseCountryCodeModal } from '../../CountryCodeSelect.dom.tsx';
import { AxoTextField } from '../../../axo/fields/AxoTextField.dom.tsx';
import {
  Buttons,
  Container,
  Description,
  InputContainer,
  Spacer,
  Title,
  TopMatter,
} from '../util/StepComponents.dom.tsx';
import { useCountdownDuration } from '../util/useCountdownDuration.std.ts';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { PhoneNumberStage } from '../../../types/StandaloneRegistration.std.ts';
import type { moveToCaptchaStage as doMoveToCaptchaStage } from '../../../state/ducks/standaloneInstaller.preload.ts';
import type { CountryDataType } from '../../../util/getCountryData.dom.ts';

export function PhoneNumberScreen({
  i18n,
  moveToCaptchaStage,
  cancelRegistration,
  countries,
  workflow,
}: {
  i18n: LocalizerType;
  moveToCaptchaStage: ActionCreator<typeof doMoveToCaptchaStage>;
  cancelRegistration: () => unknown;
  countries: ReadonlyArray<CountryDataType>;
  workflow: PhoneNumberStage;
}): JSX.Element {
  const textFieldRef = useRef<HTMLInputElement | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(
    workflow.phoneNumber
  );
  const [e164, setE164] = useState<string | undefined>(workflow.phoneNumber);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [countryCodeDialogOpen, setCountryCodeDialogOpen] = useState(false);
  const [duration, setDuration] = useState<string | undefined>(undefined);
  const [regionCode, setRegionCode] = useState<string | undefined>(undefined);

  const codeByRegion: Map<string, string> = useMemo(() => {
    const pairs: ReadonlyArray<[string, string]> = countries.map(item => [
      item.region,
      item.code,
    ]);
    return new Map(pairs);
  }, [countries]);
  const [isValidNumber, setIsValidNumber] = useState(false);
  const { status } = workflow;

  useCountdownDuration({
    timestamp: status.type === 'waiting' ? status.readyAt : undefined,
    setDuration,
  });

  const validateNumber = useCallback(
    (value: string, innerRegionCode?: string) => {
      const parsedNumber = parseNumber(value, innerRegionCode);
      setIsValidNumber(parsedNumber.isValidNumber);
      setPhoneNumber(value);
      if (parsedNumber.isValidNumber) {
        setE164(parsedNumber.e164);
      }
    },
    [setIsValidNumber, setPhoneNumber]
  );
  // On mount, we want to validate any prepopulated number
  useEffect(() => {
    if (phoneNumber) {
      validateNumber(phoneNumber, regionCode);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container>
      <TopMatter i18n={i18n} onBackClick={() => cancelRegistration()} />
      <Spacer className={tw('h-13')} />
      <Title text={i18n('icu:StandaloneRegistration--PhoneNumber--header')} />
      <Description>
        <div>
          {i18n('icu:StandaloneRegistration--PhoneNumber--description--line-1')}
        </div>
        <div>
          {i18n('icu:StandaloneRegistration--PhoneNumber--description--line-2')}
        </div>
      </Description>
      <Spacer className={tw('h-9')} />
      <InputContainer className={tw('w-81')}>
        <AxoTextField.Root>
          {regionCode ? (
            <div className={tw('p-1.5 ps-3 type-body-large text-primary')}>
              {codeByRegion.get(regionCode)}
            </div>
          ) : undefined}
          <AxoTextField.Action
            label="Insert emoji"
            symbol="chevron-down"
            onClick={() => setCountryCodeDialogOpen(true)}
          />
          <AxoTextField.Separator />
          <AxoTextField.Input
            ref={textFieldRef}
            autoFocus
            disabled={status.type === 'in-progress'}
            maxBytes={30}
            maxGraphemes={30}
            onValueChange={value => validateNumber(value, regionCode)}
            placeholder={i18n(
              'icu:StandaloneRegistration--PhoneNumber--placeholder'
            )}
            value={phoneNumber ?? ''}
          />
        </AxoTextField.Root>
      </InputContainer>
      <Spacer className={tw('grow')} />
      {status.type === 'waiting' && duration ? (
        <div>
          {i18n('icu:StandaloneRegistration--PhoneNumber--waiting', {
            duration,
          })}
        </div>
      ) : undefined}
      <Buttons>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          disabled={!isValidNumber || Boolean(duration)}
          pending={status.type === 'in-progress'}
          onClick={() => {
            if (!isValidNumber) {
              throw new Error(
                'PhoneNumberScreen: Cannot confirm number with invalid phone number'
              );
            }
            setConfirmationDialogOpen(true);
          }}
        >
          {i18n('icu:StandaloneRegistration--PhoneNumber--button')}
        </AxoButton.Root>
      </Buttons>
      {countryCodeDialogOpen ? (
        <ChooseCountryCodeModal
          countries={countries}
          i18n={i18n}
          onChange={value => {
            setRegionCode(value);
            if (phoneNumber) {
              validateNumber(phoneNumber, value);
            }
          }}
          onClose={() => {
            flushSync(() => {
              setCountryCodeDialogOpen(false);
            });
            textFieldRef.current?.focus();
          }}
        />
      ) : undefined}
      <ConfirmPhoneNumberDialog
        open={confirmationDialogOpen}
        setOpen={setConfirmationDialogOpen}
        phoneNumber={e164}
        i18n={i18n}
        onEdit={() => {
          flushSync(() => {
            setConfirmationDialogOpen(false);
          });
          textFieldRef.current?.focus();
        }}
        onConfirm={() => {
          if (!e164) {
            throw new Error(
              'PhoneNumberScreen: Cannot move to next stage with empty phone number'
            );
          }
          moveToCaptchaStage({ phoneNumber: e164, workflow });
        }}
      />
    </Container>
  );
}
