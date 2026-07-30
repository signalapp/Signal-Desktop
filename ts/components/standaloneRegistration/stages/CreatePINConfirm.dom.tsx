// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback } from 'react';

import type { JSX } from 'react';

import { tw } from '../../../axo/tw.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { AxoPasswordField } from '../../../axo/fields/AxoPasswordField.dom.tsx';
import {
  Buttons,
  Container,
  Description,
  InputContainer,
  Spacer,
  Title,
  TopMatter,
} from '../util/StepComponents.dom.tsx';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { CreatePINConfirmStage } from '../../../types/StandaloneRegistration.std.ts';
import {
  type goToCreatePINStage as doGoToCreatePINStage,
  type createPIN as doCreatePIN,
} from '../../../state/ducks/standaloneInstaller.preload.ts';

export function CreatePINConfirmScreen({
  createPIN,
  goToCreatePINStage,
  i18n,
  workflow,
}: {
  createPIN: ActionCreator<typeof doCreatePIN>;
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
  i18n: LocalizerType;
  workflow: CreatePINConfirmStage;
}): JSX.Element {
  const [pin, setPIN] = useState('');
  const [isValidPIN, setIsValidPIN] = useState(false);

  const { status } = workflow;
  const pending = status.type === 'in-progress';

  const onChangePIN = useCallback(
    (value: string) => {
      setIsValidPIN(value === workflow.pin);
      setPIN(value);
    },
    [setIsValidPIN, setPIN, workflow]
  );

  return (
    <Container>
      <TopMatter i18n={i18n} onBackClick={() => goToCreatePINStage()} />
      <Spacer className={tw('h-17')} />
      <Title
        text={i18n('icu:StandaloneRegistration--CreatePIN--confirming--header')}
      />
      <Description>
        {i18n('icu:StandaloneRegistration--CreatePIN--confirming--description')}
      </Description>
      <Spacer className={tw('h-8')} />
      <InputContainer className={tw('w-81')}>
        <AxoPasswordField.Root
          disabled={pending}
          autoFocus
          maxBytes={10}
          maxGraphemes={10}
          onValueChange={onChangePIN}
          placeholder={i18n(
            'icu:StandaloneRegistration--CreatePIN--confirming--placeholder'
          )}
          value={pin}
          autoComplete="new-password"
        />
      </InputContainer>
      <Spacer className={tw('h-8 grow')} />
      <Buttons>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          disabled={!isValidPIN || pending}
          pending={pending}
          onClick={() => {
            if (pin !== workflow.pin) {
              throw new Error(
                "Cannot confirm when new PIN doesn't match old PIN!"
              );
            }
            createPIN({ pin, workflow });
            return;
          }}
        >
          {i18n('icu:StandaloneRegistration--CreatePIN--continue')}
        </AxoButton.Root>
      </Buttons>
    </Container>
  );
}
