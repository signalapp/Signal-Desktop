// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback } from 'react';

import type { JSX } from 'react';

import { tw } from '../../../axo/tw.dom.tsx';
import { I18n } from '../../I18n.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.tsx';
import { AxoPasswordField } from '../../../axo/fields/AxoPasswordField.dom.tsx';
import {
  Buttons,
  Container,
  Description,
  InputContainer,
  PIN_ARTICLE_ON_SUPPORT,
  Spacer,
  Title,
  TopMatter,
} from '../util/StepComponents.dom.tsx';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { CreatePINStage } from '../../../types/StandaloneRegistration.std.ts';
import type {
  completeRegistration as doCompleteRegistration,
  startConfirmingPIN as doStartConfirmingPIN,
} from '../../../state/ducks/standaloneInstaller.preload.ts';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.ts';
import { PIN_LENGTH_MINIMUM } from './VerifyPIN.dom.tsx';

export function CreatePINScreen({
  completeRegistration,
  i18n,
  startConfirmingPIN,
  workflow,
}: {
  completeRegistration: ActionCreator<typeof doCompleteRegistration>;
  i18n: LocalizerType;
  startConfirmingPIN: ActionCreator<typeof doStartConfirmingPIN>;
  workflow: CreatePINStage;
}): JSX.Element {
  const [pin, setPIN] = useState('');
  const [isValidPIN, setIsValidPIN] = useState(false);

  const [isShowingAboutPINsDialog, setIsShowingAboutPINsDialog] =
    useState(false);
  const [isShowingDisablePINDialog, setIsShowingDisablePINDialog] =
    useState(false);

  const onChangePIN = useCallback(
    (value: string) => {
      setIsValidPIN(value.length >= PIN_LENGTH_MINIMUM);
      setPIN(value);
    },
    [setIsValidPIN, setPIN]
  );

  const topRightMenu = (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoButton.Root variant="implied-secondary" size="md">
          <AxoSymbol.Icon
            symbol="more"
            size={20}
            label={i18n('icu:StandaloneRegistration--CreatePIN--open-menu')}
          />
        </AxoButton.Root>
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item
          symbol="info"
          onSelect={() => {
            setIsShowingAboutPINsDialog(true);
          }}
        >
          {i18n('icu:StandaloneRegistration--CreatePIN--menu--more-about')}
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Item
          symbol="minus-circle"
          onSelect={() => {
            setIsShowingDisablePINDialog(true);
          }}
        >
          {i18n('icu:StandaloneRegistration--CreatePIN--menu--disable')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );

  return (
    <Container>
      <TopMatter i18n={i18n} rightContent={topRightMenu} />
      <Spacer className={tw('h-13')} />
      <Title text={i18n('icu:StandaloneRegistration--CreatePIN--header')} />
      <Description className={tw('w-100')}>
        <I18n
          i18n={i18n}
          id="icu:StandaloneRegistration--CreatePIN--description"
          components={{
            learnMore: parts => {
              return (
                <a className={tw('text-primary')} href={PIN_ARTICLE_ON_SUPPORT}>
                  {parts}
                </a>
              );
            },
          }}
        />
      </Description>
      <Spacer className={tw('h-8')} />
      <InputContainer
        className={tw('w-81')}
        helperElement={
          <div
            className={tw(
              'ms-1 mt-1.5 w-full text-start type-body-small text-secondary'
            )}
          >
            {i18n('icu:StandaloneRegistration--CreatePIN--helper-text')}
          </div>
        }
      >
        <AxoPasswordField.Root
          autoFocus
          maxBytes={10}
          maxGraphemes={10}
          onValueChange={onChangePIN}
          placeholder={i18n(
            'icu:StandaloneRegistration--CreatePIN--placeholder'
          )}
          value={pin}
          autoComplete="new-password"
        />
      </InputContainer>
      <Spacer className={tw('grow')} />
      <Buttons>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          disabled={!isValidPIN}
          onClick={() => {
            if (pin.length < PIN_LENGTH_MINIMUM) {
              throw new Error(
                `Cannot start confiming if PIN is not valid (length ${pin.length}`
              );
            }
            startConfirmingPIN({ pin, workflow });
          }}
        >
          {i18n('icu:StandaloneRegistration--CreatePIN--continue')}
        </AxoButton.Root>
      </Buttons>
      <AboutPINsDialog
        i18n={i18n}
        isOpen={isShowingAboutPINsDialog}
        setOpen={setIsShowingAboutPINsDialog}
      />
      <DisablePinDialog
        i18n={i18n}
        isOpen={isShowingDisablePINDialog}
        setOpen={setIsShowingDisablePINDialog}
        completeRegistration={completeRegistration}
        workflow={workflow}
      />
    </Container>
  );
}

function AboutPINsDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
}): JSX.Element {
  return (
    <AxoAlertDialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setOpen(false);
        }
      }}
    >
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:StandaloneRegistration--CreatePIN--AboutPINs--header')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--AboutPINs--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-secondary"
            onClick={() => {
              openLinkInWebBrowser(PIN_ARTICLE_ON_SUPPORT);
              setOpen(false);
            }}
          >
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--AboutPINs--learn-more-button'
            )}
          </AxoConfirmDialog.Action>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--AboutPINs--ok-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function DisablePinDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  completeRegistration,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  completeRegistration: ActionCreator<typeof doCompleteRegistration>;
  workflow: CreatePINStage;
}): JSX.Element {
  return (
    <AxoAlertDialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setOpen(false);
        }
      }}
    >
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--DisableWarning--header'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--DisableWarning--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-secondary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--DisableWarning--cancel'
            )}
          </AxoConfirmDialog.Action>
          <AxoConfirmDialog.Action
            variant="strong-destructive"
            onClick={() => {
              completeRegistration({ workflow });
              setOpen(false);
            }}
          >
            {i18n(
              'icu:StandaloneRegistration--CreatePIN--DisableWarning--disable-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
