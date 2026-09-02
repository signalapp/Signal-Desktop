// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, useRef, useCallback } from 'react';

import type { JSX } from 'react';

import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import { SECOND } from '../../../util/durations/constants.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import {
  Buttons,
  Container,
  Description,
  Spacer,
  Title,
  TopMatter,
} from '../util/StepComponents.dom.tsx';
import { useCountdownDuration } from '../util/useCountdownDuration.std.ts';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { CaptchaStage } from '../../../types/StandaloneRegistration.std.ts';
import type {
  moveToVerificationStage as doMoveToVerificationStage,
  openBrowserForCaptcha as doOpenBrowserForCaptcha,
  startRegistration as doStartRegistration,
} from '../../../state/ducks/standaloneInstaller.preload.ts';

export function CaptchaScreen({
  i18n,
  moveToVerificationStage,
  openBrowserForCaptcha,
  startRegistration,
  workflow,
}: {
  i18n: LocalizerType;
  moveToVerificationStage: ActionCreator<typeof doMoveToVerificationStage>;
  openBrowserForCaptcha: ActionCreator<typeof doOpenBrowserForCaptcha>;
  startRegistration: ActionCreator<typeof doStartRegistration>;
  workflow: CaptchaStage;
}): JSX.Element {
  const [needAnotherDialogOpen, setNeedAnotherDialogOpen] = useState(false);
  const [mustWaitDialogOpen, setMustWaitDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [showOpenBrowserButton, setShowOpenBrowserButton] = useState(false);
  const [duration, setDuration] = useState<string | undefined>(undefined);
  const { status } = workflow;
  const pending = status.type === 'in-progress';

  const updateCountdown = useCallback(
    (newDuration: string | undefined) => {
      if (!duration && newDuration) {
        setMustWaitDialogOpen(true);
      }

      setDuration(newDuration);
    },
    [duration, setDuration, setMustWaitDialogOpen]
  );

  useCountdownDuration({
    timestamp: status.type === 'waiting' ? status.canDoCaptchaAt : undefined,
    setDuration: updateCountdown,
  });

  useEffect(() => {
    if (status.type !== 'in-progress') {
      return;
    }

    const { startedAt } = status;
    const showButtonAt = startedAt + 30 * SECOND;
    const msUntil = showButtonAt - Date.now();

    let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
      setShowOpenBrowserButton(true);

      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    }, msUntil);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [status, setShowOpenBrowserButton]);

  const previousWorkflow = useRef<CaptchaStage | undefined>(undefined);
  // oxlint-disable-next-line react/refs
  if (workflow !== previousWorkflow.current) {
    // oxlint-disable-next-line react/refs
    previousWorkflow.current = workflow;

    if (status.type === 'failed') {
      setErrorDialogOpen(true);
    } else if (status.type === 'another-needed') {
      setNeedAnotherDialogOpen(true);
    } else if (status.type === 'ready') {
      // Nothing to do!
    } else if (status.type === 'waiting' || status.type === 'in-progress') {
      // Handled in useEffects above
    } else {
      throw missingCaseError(status);
    }
  }

  return (
    <Container>
      <TopMatter i18n={i18n} onBackClick={() => startRegistration()} />
      <Spacer className={tw('h-13')} />
      <Title text={i18n('icu:StandaloneRegistration--Captcha--header')} />
      <Description>
        {i18n('icu:StandaloneRegistration--Captcha--description')}
      </Description>
      {showOpenBrowserButton ? (
        <>
          <Spacer className={tw('h-15 grow')} />
          <AxoButton.Root
            size="md"
            variant="implied-primary"
            onClick={() => openBrowserForCaptcha()}
          >
            {i18n('icu:StandaloneRegistration--Captcha--retry-button')}
          </AxoButton.Root>
          <Spacer className={tw('h-15 grow')} />
        </>
      ) : (
        <Spacer className={tw('h-35.5 grow')} />
      )}
      <Buttons>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          disabled={Boolean(duration)}
          onClick={() => moveToVerificationStage({ workflow })}
          pending={pending}
        >
          <AxoSymbol.InlineGlyph symbol="arrow-square-up[end]" label="" />
          &nbsp;
          {duration
            ? i18n('icu:StandaloneRegistration--Captcha--button--wait', {
                duration,
              })
            : i18n('icu:StandaloneRegistration--Captcha--button')}
        </AxoButton.Root>
      </Buttons>
      <NeedAnotherDialog
        i18n={i18n}
        isOpen={needAnotherDialogOpen}
        setOpen={setNeedAnotherDialogOpen}
        moveToVerificationStage={moveToVerificationStage}
        workflow={workflow}
      />
      <MustWaitDialog
        i18n={i18n}
        isOpen={mustWaitDialogOpen}
        setOpen={setMustWaitDialogOpen}
        duration={duration}
      />
      <ErrorDialog
        i18n={i18n}
        isOpen={errorDialogOpen}
        setOpen={setErrorDialogOpen}
        moveToVerificationStage={moveToVerificationStage}
        workflow={workflow}
      />
    </Container>
  );
}

function NeedAnotherDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  moveToVerificationStage,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  moveToVerificationStage: ActionCreator<typeof doMoveToVerificationStage>;
  workflow: CaptchaStage;
}): JSX.Element {
  return (
    <AxoConfirmDialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setOpen(false);
        }
      }}
      title={i18n('icu:StandaloneRegistration--Captcha--NeedAnother--header')}
      description={i18n(
        'icu:StandaloneRegistration--Captcha--NeedAnother--description'
      )}
    >
      <AxoConfirmDialog.Action
        variant="strong-secondary"
        onClick={() => setOpen(false)}
      >
        {i18n('icu:StandaloneRegistration--Captcha--NeedAnother--cancel')}
      </AxoConfirmDialog.Action>
      <AxoConfirmDialog.Action
        variant="strong-primary"
        onClick={() => {
          moveToVerificationStage({ workflow });
        }}
      >
        {i18n('icu:StandaloneRegistration--Captcha--NeedAnother--retry')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

function MustWaitDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  duration,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  duration: string | undefined;
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
          <AxoAlertDialog.Title screenReaderOnly>
            {i18n('icu:StandaloneRegistration--Captcha--MustWait--aria-title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <div>
              <div>
                {i18n('icu:StandaloneRegistration--Captcha--MustWait--line-1')}
              </div>
              <div>
                {i18n('icu:StandaloneRegistration--Captcha--MustWait--line-2', {
                  duration: duration ?? '',
                })}
              </div>
            </div>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n('icu:StandaloneRegistration--Captcha--MustWait--button')}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function ErrorDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  moveToVerificationStage,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  moveToVerificationStage: ActionCreator<typeof doMoveToVerificationStage>;
  workflow: CaptchaStage;
}): JSX.Element {
  return (
    <AxoConfirmDialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setOpen(false);
        }
      }}
      title={i18n('icu:StandaloneRegistration--Captcha--Error--header')}
      description={i18n(
        'icu:StandaloneRegistration--Captcha--Error--description'
      )}
    >
      <AxoConfirmDialog.Action
        variant="strong-secondary"
        onClick={() => setOpen(false)}
      >
        {i18n('icu:StandaloneRegistration--Captcha--Error--cancel')}
      </AxoConfirmDialog.Action>
      <AxoConfirmDialog.Action
        variant="strong-primary"
        onClick={() => moveToVerificationStage({ workflow })}
      >
        {i18n('icu:StandaloneRegistration--Captcha--Error--try-again')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
