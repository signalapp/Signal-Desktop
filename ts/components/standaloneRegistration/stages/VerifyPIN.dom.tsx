// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback, useRef } from 'react';

import type { JSX, ReactNode } from 'react';

import { I18n } from '../../I18n.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
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
import type { VerifyPINStage } from '../../../types/StandaloneRegistration.std.ts';
import type {
  goToAccountLockedStage as doGoToAccountLockedStage,
  goToCreatePINStage as doGoToCreatePINStage,
  verifyPIN as doVerifyPIN,
} from '../../../state/ducks/standaloneInstaller.preload.ts';
import { AxoPasswordField } from '../../../axo/fields/AxoPasswordField.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.ts';
import { CONTACT_SUPPORT_URL } from '../../../util/contactSupport.dom.tsx';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { isNumber } from 'lodash';

const FIRST_REGLOCK_TRIES_THRESHOLD = 5;
const SECOND_REGLOCK_TRIES_THRESHOLD = 3;
const FIRST_NON_REGLOCK_TRIES_THRESHOLD = 3;
const SECOND_NON_REGLOCK_TRIES_THRESHOLD = 1;

export const PIN_LENGTH_MINIMUM = 4;

export function VerifyPINScreen({
  verifyPIN,
  goToCreatePINStage,
  goToAccountLockedStage,
  i18n,
  workflow,
}: {
  verifyPIN: ActionCreator<typeof doVerifyPIN>;
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
  goToAccountLockedStage: ActionCreator<typeof doGoToAccountLockedStage>;
  i18n: LocalizerType;
  workflow: VerifyPINStage;
}): JSX.Element {
  const [pin, setPIN] = useState('');
  const [isValidPIN, setIsValidPIN] = useState(false);
  const [needHelpDialogOpen, setNeedHelpDialogOpen] = useState(false);
  const [skipPINDialogOpen, setSkipPINDialogOpen] = useState(false);
  const [fewRemainingTriesDialogOpen, setFewRemainingTriesDialogOpen] =
    useState(false);
  const [noRemainingTriesDialogOpen, setNoRemainingTriesDialogOpen] =
    useState(false);

  const [shouldShowIncorrectPIN, setShouldShowIncorrectPIN] = useState<
    | { type: 'error' }
    | { type: 'error-with-count'; count: number }
    | { type: 'count'; count: number }
    | undefined
  >(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const onChangePIN = useCallback(
    (value: string) => {
      inputRef.current?.setCustomValidity('');
      setIsValidPIN(value.length >= PIN_LENGTH_MINIMUM);
      setPIN(value);
    },
    [setIsValidPIN, setPIN]
  );

  const { status } = workflow;
  const pending = status.type === 'in-progress';
  const isIncorrectPin =
    status.type === 'failed' && status.error === 'incorrect-pin';

  const hasReglock = Boolean(workflow.dataForReglockAccountCreate);

  const menu = hasReglock ? undefined : (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoButton.Root variant="implied-secondary" size="md">
          <AxoSymbol.Icon
            symbol="more"
            size={20}
            label={i18n('icu:StandaloneRegistration--VerifyPIN--open-menu')}
          />
        </AxoButton.Root>
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item
          symbol="arrow-circle-[end]"
          onSelect={() => {
            setSkipPINDialogOpen(true);
          }}
        >
          {i18n('icu:StandaloneRegistration--VerifyPIN--menu--skip-pin')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );

  const { triesRemaining } = workflow;
  const previousTriesRemaining = useRef<number | undefined>(undefined);

  let helperElement: ReactNode | undefined;

  if (
    previousTriesRemaining.current !== triesRemaining &&
    isNumber(triesRemaining)
  ) {
    previousTriesRemaining.current = triesRemaining;

    if (
      hasReglock &&
      (triesRemaining === FIRST_REGLOCK_TRIES_THRESHOLD ||
        triesRemaining === SECOND_REGLOCK_TRIES_THRESHOLD)
    ) {
      setFewRemainingTriesDialogOpen(true);
    }
    if (hasReglock && triesRemaining === 0) {
      goToAccountLockedStage();
    }

    if (
      !hasReglock &&
      (triesRemaining === FIRST_NON_REGLOCK_TRIES_THRESHOLD ||
        triesRemaining === SECOND_NON_REGLOCK_TRIES_THRESHOLD)
    ) {
      setFewRemainingTriesDialogOpen(true);
    }
    if (!hasReglock && triesRemaining === 0) {
      setNoRemainingTriesDialogOpen(true);
    }

    if (
      (hasReglock && triesRemaining <= FIRST_REGLOCK_TRIES_THRESHOLD) ||
      (!hasReglock && triesRemaining <= FIRST_NON_REGLOCK_TRIES_THRESHOLD)
    ) {
      if (isIncorrectPin) {
        inputRef.current?.setCustomValidity('invalid');
        setShouldShowIncorrectPIN({
          type: 'error-with-count',
          count: triesRemaining,
        });
      } else {
        inputRef.current?.setCustomValidity('invalid');
        setShouldShowIncorrectPIN({
          type: 'count',
          count: triesRemaining,
        });
      }
    } else if (isIncorrectPin) {
      inputRef.current?.setCustomValidity('invalid');
      setShouldShowIncorrectPIN({ type: 'error' });
    }
  }

  if (shouldShowIncorrectPIN?.type === 'count') {
    helperElement = (
      <div
        className={tw(
          'ms-1 mt-1.5 w-full text-start type-body-small text-destructive'
        )}
      >
        {i18n('icu:StandaloneRegistration--VerifyPIN--just-count', {
          triesRemaining: shouldShowIncorrectPIN.count,
        })}
      </div>
    );
  }
  if (shouldShowIncorrectPIN?.type === 'error-with-count') {
    helperElement = (
      <div
        className={tw(
          'ms-1 mt-1.5 w-full text-start type-body-small text-destructive'
        )}
      >
        {i18n(
          'icu:StandaloneRegistration--VerifyPIN--incorrect-pin--with-count',
          { triesRemaining: shouldShowIncorrectPIN.count }
        )}
      </div>
    );
  } else if (shouldShowIncorrectPIN?.type === 'error') {
    helperElement = (
      <div
        className={tw(
          'ms-1 mt-1.5 w-full text-start type-body-small text-destructive'
        )}
      >
        {i18n('icu:StandaloneRegistration--VerifyPIN--incorrect-pin')}
      </div>
    );
  }

  return (
    <Container>
      <TopMatter i18n={i18n} rightContent={menu} />
      <Spacer className={tw('h-14')} />
      <Title text={i18n('icu:StandaloneRegistration--VerifyPIN--header')} />
      <Description>
        <I18n
          i18n={i18n}
          id="icu:StandaloneRegistration--VerifyPIN--description"
          components={{
            needHelp: parts => {
              return (
                <button
                  type="button"
                  className={tw('text-primary')}
                  onClick={e => {
                    setNeedHelpDialogOpen(true);
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onKeyUp={e => {
                    if (e.key === 'Enter') {
                      setNeedHelpDialogOpen(true);
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {parts}
                </button>
              );
            },
          }}
        />
      </Description>
      <Spacer className={tw('h-10')} />
      <InputContainer className={tw('w-81')} helperElement={helperElement}>
        <AxoPasswordField.Root
          ref={inputRef}
          autoFocus
          maxBytes={10}
          maxGraphemes={10}
          onValueChange={onChangePIN}
          disabled={pending}
          placeholder={i18n(
            'icu:StandaloneRegistration--VerifyPIN--placeholder'
          )}
          value={pin}
          autoComplete="current-password"
        />
      </InputContainer>
      <Spacer className={tw('grow')} />
      <Buttons>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          pending={pending}
          disabled={!isValidPIN || pending}
          onClick={() => {
            setShouldShowIncorrectPIN(undefined);
            verifyPIN({ pin, workflow });
          }}
        >
          {i18n('icu:StandaloneRegistration--ProfileEntry--continue')}
        </AxoButton.Root>
      </Buttons>
      <NeedHelpDialog
        i18n={i18n}
        isOpen={needHelpDialogOpen}
        setOpen={setNeedHelpDialogOpen}
        hasReglock={hasReglock}
        goToCreatePINStage={goToCreatePINStage}
      />
      <SkipPINDialog
        i18n={i18n}
        isOpen={skipPINDialogOpen}
        setOpen={setSkipPINDialogOpen}
        goToCreatePINStage={goToCreatePINStage}
      />
      <FewRemainingTriesDialog
        i18n={i18n}
        isOpen={fewRemainingTriesDialogOpen}
        setOpen={setFewRemainingTriesDialogOpen}
        hasReglock={hasReglock}
        triesRemaining={triesRemaining ?? 0}
      />
      <NoRemainingTriesDialog
        i18n={i18n}
        isOpen={noRemainingTriesDialogOpen}
        setOpen={setNoRemainingTriesDialogOpen}
        goToCreatePINStage={goToCreatePINStage}
      />
    </Container>
  );
}

const learnMore = (parts: ReactNode) => {
  return (
    <a className={tw('text-primary')} href={PIN_ARTICLE_ON_SUPPORT}>
      {parts}
    </a>
  );
};

function NeedHelpDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  hasReglock,
  goToCreatePINStage,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  hasReglock: boolean;
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
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
            <div className={tw('text-start')}>
              {i18n('icu:StandaloneRegistration--VerifyPIN--NeedHelp--header')}
            </div>
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <div className={tw('text-start')}>
              {hasReglock ? (
                <I18n
                  i18n={i18n}
                  id="icu:StandaloneRegistration--VerifyPIN--NeedHelp--description--reglock"
                  components={{ learnMore }}
                />
              ) : (
                <I18n
                  i18n={i18n}
                  id="icu:StandaloneRegistration--VerifyPIN--NeedHelp--description--no-reglock"
                  components={{ learnMore }}
                />
              )}
            </div>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer forceAlwaysBreakToSeparateLines>
          <AxoAlertDialog.Action
            variant="strong-secondary"
            onClick={() => setOpen(false)}
          >
            {i18n('icu:StandaloneRegistration--VerifyPIN--NeedHelp--cancel')}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            variant="strong-secondary"
            onClick={() => openLinkInWebBrowser(CONTACT_SUPPORT_URL)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--NeedHelp--contact-support-button'
            )}
          </AxoAlertDialog.Action>
          {hasReglock ? undefined : (
            <AxoAlertDialog.Action
              variant="subtle-destructive"
              onClick={() => goToCreatePINStage()}
            >
              {i18n(
                'icu:StandaloneRegistration--VerifyPIN--NeedHelp--skip-button--no-reglock'
              )}
            </AxoAlertDialog.Action>
          )}
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
function SkipPINDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  goToCreatePINStage,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
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
            <div className={tw('text-start')}>
              {i18n('icu:StandaloneRegistration--VerifyPIN--SkipPIN--header')}
            </div>
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <div className={tw('text-start')}>
              <I18n
                i18n={i18n}
                id="icu:StandaloneRegistration--VerifyPIN--SkipPIN--description"
                components={{
                  learnMore,
                }}
              />
            </div>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer forceAlwaysBreakToSeparateLines>
          <AxoAlertDialog.Action
            variant="strong-secondary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--SkipPIN--cancel-button'
            )}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            variant="subtle-destructive"
            onClick={() => goToCreatePINStage()}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--SkipPIN--skip-button'
            )}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function FewRemainingTriesDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  hasReglock,
  triesRemaining,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  hasReglock: boolean;
  triesRemaining: number;
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
            <div className={tw('text-start')}>
              {i18n(
                'icu:StandaloneRegistration--VerifyPIN--FewRemainingTries--header'
              )}
            </div>
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <div className={tw('text-start')}>
              {hasReglock ? (
                <I18n
                  i18n={i18n}
                  id="icu:StandaloneRegistration--VerifyPIN--FewRemainingTries--description--reglock"
                  components={{ learnMore, triesRemaining }}
                />
              ) : (
                <I18n
                  i18n={i18n}
                  id="icu:StandaloneRegistration--VerifyPIN--FewRemainingTries--description--no-reglock"
                  components={{ learnMore, triesRemaining }}
                />
              )}
            </div>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer forceAlwaysBreakToSeparateLines>
          <AxoAlertDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--FewRemainingTries--button'
            )}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function NoRemainingTriesDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  goToCreatePINStage,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
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
            <div className={tw('text-start')}>
              {i18n(
                'icu:StandaloneRegistration--VerifyPIN--NoRemainingTries--header'
              )}
            </div>
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <div className={tw('text-start')}>
              {i18n(
                'icu:StandaloneRegistration--VerifyPIN--NoRemainingTries--description'
              )}
            </div>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer forceAlwaysBreakToSeparateLines>
          <AxoAlertDialog.Action
            variant="strong-secondary"
            onClick={() => openLinkInWebBrowser(PIN_ARTICLE_ON_SUPPORT)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--NoRemainingTries--learn-more'
            )}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            variant="strong-primary"
            onClick={() => goToCreatePINStage()}
          >
            {i18n(
              'icu:StandaloneRegistration--VerifyPIN--NoRemainingTries--create-new-pin'
            )}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
