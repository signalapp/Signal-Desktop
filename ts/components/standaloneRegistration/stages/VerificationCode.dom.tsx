// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, useCallback, useRef } from 'react';
import { unstable_OneTimePasswordField as OneTimePasswordField } from 'radix-ui';

import type { JSX } from 'react';

import { createLogger } from '../../../logging/log.std.ts';
import { VerificationTransport } from '../../../types/VerificationTransport.std.ts';
import { format as formatPhoneNumber } from '../../../types/PhoneNumber.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { ConfirmPhoneNumberDialog } from '../util/ConfirmPhoneNumberDialog.dom.tsx';
import {
  Buttons,
  Container,
  Description,
  Spacer,
  Title,
  TopMatter,
} from '../util/StepComponents.dom.tsx';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { VerificationCodeStage } from '../../../types/StandaloneRegistration.std.ts';
import type {
  requestVerificationCode as doRequestVerificationCode,
  startRegistration as doStartRegistration,
  submitVerificationCode as doSubmitVerificationCode,
} from '../../../state/ducks/standaloneInstaller.preload.ts';
import classNames from 'classnames';
import { useCountdownDuration } from '../util/useCountdownDuration.std.ts';

const log = createLogger('StandaloneRegistration/stages/VerificationCode');

const VERIFICATION_CODE_LENGTH = 6;
const HAVING_TROUBLE_CODE_ATTEMPTS = 3;
const MAX_CODE_ATTEMPTS = 5;

export function VerificationCodeScreen({
  i18n,
  requestVerificationCode,
  startRegistration,
  submitVerificationCode,
  workflow,
}: {
  i18n: LocalizerType;
  requestVerificationCode: ActionCreator<typeof doRequestVerificationCode>;
  startRegistration: ActionCreator<typeof doStartRegistration>;
  submitVerificationCode: ActionCreator<typeof doSubmitVerificationCode>;
  workflow: VerificationCodeStage;
}): JSX.Element {
  const { phoneNumber, timings } = workflow;
  const [code, setCode] = useState('');
  const [isValidCode, setIsValidCode] = useState(false);
  const focusRef = useRef<HTMLInputElement | null>(null);

  const [incorrectCodeDialogOpen, setIncorrectCodeDialogOpen] = useState(false);
  const [invalidCodeDialogOpen, setInvalidCodeDialogOpen] = useState(false);
  const [voiceCallNeededDialogOpen, setVoiceCallNeededDialogOpen] =
    useState(false);
  const [mustWaitDialogOpen, setMustWaitDialogOpen] = useState(false);
  const [maximumAttemptsDialogOpen, setMaximumAttemptsDialogOpen] =
    useState(false);
  const [failedToCallDialogOpen, setFailedToCallDialogOpen] = useState(false);
  const [
    cannotSendCodeTemporaryDialogOpen,
    setCannotSendCodeTemporaryDialogOpen,
  ] = useState(false);
  const [
    cannotSendCodePermanentDialogOpen,
    setCannotSendCodePermanentDialogOpen,
  ] = useState(false);

  const [tranportForCodeSend, setTransportForCodeSend] = useState<
    VerificationTransport | undefined
  >(undefined);

  const [shouldShowHavingTrouble, setShouldShowHavingTrouble] = useState(false);
  const [waitSMSDuration, setWaitSMSDuration] = useState<string | undefined>(
    undefined
  );
  const [waitCallDuration, setWaitCallDuration] = useState<string | undefined>(
    undefined
  );
  const [waitSubmitDuration, setWaitSubmitDuration] = useState<
    string | undefined
  >(undefined);

  const previousWorkflow = useRef<VerificationCodeStage | undefined>(undefined);
  const previous = previousWorkflow.current;
  const current = workflow;
  previousWorkflow.current = workflow;

  if (current !== previous) {
    const currentStatus = current.status;
    const previousStatus = previous?.status;

    if (isErrorTypeNew(currentStatus, previousStatus, 'incorrect-code')) {
      setIncorrectCodeDialogOpen(true);
    }
    if (isErrorTypeNew(currentStatus, previousStatus, 'invalid-code')) {
      setInvalidCodeDialogOpen(true);
    }
    if (
      isErrorTypeNew(
        currentStatus,
        previousStatus,
        'cannot-send-code-temporary'
      )
    ) {
      setCannotSendCodeTemporaryDialogOpen(true);
    }
    if (
      isErrorTypeNew(
        currentStatus,
        previousStatus,
        'cannot-send-code-permanent'
      )
    ) {
      setCannotSendCodePermanentDialogOpen(true);
    }
    if (
      current.failedToSendSMS &&
      current.failedToSendSMS !== previous?.failedToSendSMS
    ) {
      setVoiceCallNeededDialogOpen(true);
    }
    if (
      current.failedToCall &&
      current.failedToCall !== previous?.failedToCall
    ) {
      setFailedToCallDialogOpen(true);
    }
    if (current.failedSubmitCodeCount >= HAVING_TROUBLE_CODE_ATTEMPTS) {
      setShouldShowHavingTrouble(true);
    }
    if (current.failedSubmitCodeCount >= MAX_CODE_ATTEMPTS) {
      setMaximumAttemptsDialogOpen(true);
    }
  }

  const { status } = workflow;
  const pending =
    status.type === 'requesting-code' || status.type === 'submitting-code';

  const { callCanBeRequestedAt, codeCanBeSubmittedAt, smsCanBeRequestedAt } =
    timings || {};
  const updateCodeSubmitCountdown = useCallback(
    (newDuration: string | undefined) => {
      if (
        !waitSubmitDuration &&
        newDuration &&
        workflow.status.type !== 'failed' // we have error-specific dialogs
      ) {
        setMustWaitDialogOpen(true);
      }

      setWaitSubmitDuration(newDuration);
    },
    [setMustWaitDialogOpen, setWaitSubmitDuration, waitSubmitDuration, workflow]
  );
  useCountdownDuration({
    timestamp: codeCanBeSubmittedAt,
    setDuration: updateCodeSubmitCountdown,
  });
  useCountdownDuration({
    timestamp: callCanBeRequestedAt,
    setDuration: setWaitCallDuration,
  });
  useCountdownDuration({
    timestamp: smsCanBeRequestedAt,
    setDuration: setWaitSMSDuration,
  });

  const onValueChange = useCallback(
    (value: string) => {
      setIsValidCode(value.length === VERIFICATION_CODE_LENGTH);
      setCode(value);
    },
    [setIsValidCode, setCode]
  );

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  return (
    <Container>
      <TopMatter
        i18n={i18n}
        onBackClick={() =>
          startRegistration({ startingPhoneNumber: phoneNumber })
        }
      />
      <Spacer className={tw('h-20')} />
      <Title
        text={i18n('icu:StandaloneRegistration--VerificationCode--header')}
      />
      <Description>
        {i18n('icu:StandaloneRegistration--VerificationCode--description', {
          phoneNumber: formatPhoneNumber(phoneNumber, {}),
        })}
        <AxoButton.Root
          variant="implied-secondary"
          size="md"
          onClick={() =>
            startRegistration({ startingPhoneNumber: phoneNumber })
          }
        >
          {i18n('icu:StandaloneRegistration--VerificationCode--wrong-number')}
        </AxoButton.Root>
      </Description>
      <Spacer className={tw('h-8')} />
      <OneTimePasswordField.Root
        autoFocus
        value={code}
        disabled={pending}
        onValueChange={onValueChange}
        className={tw('flex flex-nowrap gap-2')}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <OneTimePasswordField.Input
            ref={i === 0 ? focusRef : undefined}
            className={classNames(
              tw(
                'me-2.5 size-8 rounded-xl border-[0.5px] border-primary p-2.5 type-body-medium shadow-elevation-0',
                'focus:outline-none keyboard-mode:focus:axo-focus-ring'
              ),
              i === 2 ? tw('me-6') : undefined
            )}
          />
        ))}
      </OneTimePasswordField.Root>
      <Spacer className={tw('h-18')} />
      {workflow.failedToSendSMS ? undefined : (
        <AxoButton.Root
          variant="implied-primary"
          size="md"
          pending={
            status.type === 'requesting-code' &&
            status.transport === VerificationTransport.SMS
          }
          disabled={Boolean(waitSMSDuration) || pending}
          onClick={() => setTransportForCodeSend(VerificationTransport.SMS)}
        >
          {waitSMSDuration
            ? i18n(
                'icu:StandaloneRegistration--VerificationCode--send-sms--duration',
                {
                  duration: waitSMSDuration,
                }
              )
            : i18n('icu:StandaloneRegistration--VerificationCode--send-sms')}
        </AxoButton.Root>
      )}
      {workflow.failedToCall ? undefined : (
        <>
          <Spacer className={tw('h-3')} />
          <AxoButton.Root
            variant="implied-primary"
            size="md"
            pending={
              status.type === 'requesting-code' &&
              status.transport === VerificationTransport.Voice
            }
            disabled={Boolean(waitCallDuration) || pending}
            onClick={() => setTransportForCodeSend(VerificationTransport.Voice)}
          >
            {waitCallDuration
              ? i18n(
                  'icu:StandaloneRegistration--VerificationCode--call-me--duration',
                  { duration: waitCallDuration }
                )
              : i18n('icu:StandaloneRegistration--VerificationCode--call-me')}
          </AxoButton.Root>
        </>
      )}
      <Spacer className={tw('h-15 grow')} />
      <Buttons
        leftSideContent={
          shouldShowHavingTrouble ? (
            <AxoButton.Root
              variant="implied-primary"
              size="md"
              onClick={
                () => undefined
                // TODO: what to show when user clicks Having Trouble?
              }
            >
              {i18n(
                'icu:StandaloneRegistration--VerificationCode--having-trouble'
              )}
            </AxoButton.Root>
          ) : undefined
        }
      >
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          pending={status.type === 'submitting-code'}
          disabled={
            !isValidCode ||
            status.type === 'requesting-code' ||
            Boolean(waitSubmitDuration) ||
            workflow.failedSubmitCodeCount >= MAX_CODE_ATTEMPTS
          }
          onClick={() => submitVerificationCode({ code, workflow })}
        >
          {i18n('icu:StandaloneRegistration--VerificationCode--button')}
        </AxoButton.Root>
      </Buttons>
      <ConfirmPhoneNumberDialog
        open={Boolean(tranportForCodeSend)}
        setOpen={newOpen => {
          if (!newOpen) {
            setTransportForCodeSend(undefined);
          }
        }}
        phoneNumber={phoneNumber}
        i18n={i18n}
        onEdit={() => startRegistration({ startingPhoneNumber: phoneNumber })}
        onConfirm={() => {
          if (!tranportForCodeSend) {
            log.error('VerificationCode: transportForCodeSend is not set!');
            return;
          }
          requestVerificationCode({ transport: tranportForCodeSend, workflow });
        }}
      />
      <IncorrectCodeDialog
        i18n={i18n}
        isOpen={incorrectCodeDialogOpen}
        setOpen={setIncorrectCodeDialogOpen}
      />
      <InvalidCodeDialog
        i18n={i18n}
        isOpen={invalidCodeDialogOpen}
        setOpen={setInvalidCodeDialogOpen}
        startRegistration={startRegistration}
        workflow={workflow}
      />
      <MaximumAttemptsDialog
        i18n={i18n}
        isOpen={maximumAttemptsDialogOpen}
        setOpen={setMaximumAttemptsDialogOpen}
        startRegistration={startRegistration}
        workflow={workflow}
      />
      <VoiceCallNeededDialog
        i18n={i18n}
        isOpen={voiceCallNeededDialogOpen}
        setOpen={setVoiceCallNeededDialogOpen}
        requestVerificationCode={requestVerificationCode}
        workflow={workflow}
      />
      <FailedToCallDialog
        i18n={i18n}
        isOpen={failedToCallDialogOpen}
        setOpen={setFailedToCallDialogOpen}
        startRegistration={startRegistration}
        workflow={workflow}
      />
      <MustWaitDialog
        i18n={i18n}
        isOpen={mustWaitDialogOpen}
        setOpen={setMustWaitDialogOpen}
        waitSubmitDuration={waitSubmitDuration}
      />
      <CannotSendCodeTemporaryDialog
        i18n={i18n}
        isOpen={cannotSendCodeTemporaryDialogOpen}
        setOpen={setCannotSendCodeTemporaryDialogOpen}
        waitSubmitDuration={waitSubmitDuration}
      />
      <CannotSendCodePermanentDialog
        i18n={i18n}
        isOpen={cannotSendCodePermanentDialogOpen}
        setOpen={setCannotSendCodePermanentDialogOpen}
        startRegistration={startRegistration}
        workflow={workflow}
      />
    </Container>
  );
}

function isErrorTypeNew(
  currentStatus: VerificationCodeStage['status'],
  previousStatus: VerificationCodeStage['status'] | undefined,
  errorType:
    | 'cannot-send-code-permanent'
    | 'cannot-send-code-temporary'
    | 'incorrect-code'
    | 'invalid-code'
) {
  return (
    currentStatus.type === 'failed' &&
    currentStatus.error === errorType &&
    (!previousStatus ||
      previousStatus.type !== 'failed' ||
      previousStatus.error !== errorType)
  );
}

function IncorrectCodeDialog({
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
          <AxoAlertDialog.Title screenReaderOnly>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--IncorrectCode--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--IncorrectCode--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--IncorrectCode--button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function InvalidCodeDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  startRegistration,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  startRegistration: ActionCreator<typeof doStartRegistration>;
  workflow: VerificationCodeStage;
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
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title screenReaderOnly>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CodeInvalid--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CodeInvalid--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-secondary"
            onClick={() =>
              startRegistration({ startingPhoneNumber: workflow.phoneNumber })
            }
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CodeInvalid--edit-number-button'
            )}
          </AxoConfirmDialog.Action>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CodeInvalid--resend-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function MaximumAttemptsDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  startRegistration,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  startRegistration: ActionCreator<typeof doStartRegistration>;
  workflow: VerificationCodeStage;
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
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title screenReaderOnly>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MaximumAttempts--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MaximumAttempts--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-secondary"
            onClick={() =>
              startRegistration({ startingPhoneNumber: workflow.phoneNumber })
            }
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MaximumAttempts--edit-number-button'
            )}
          </AxoConfirmDialog.Action>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MaximumAttempts--resend-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
function VoiceCallNeededDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  requestVerificationCode,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  requestVerificationCode: ActionCreator<typeof doRequestVerificationCode>;
  workflow: VerificationCodeStage;
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
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--SMSFailed--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--SMSFailed--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-secondary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--SMSFailed--cancel'
            )}
          </AxoConfirmDialog.Action>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() =>
              requestVerificationCode({
                transport: VerificationTransport.Voice,
                workflow,
              })
            }
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--SMSFailed--confirm'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function FailedToCallDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  startRegistration,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  startRegistration: ActionCreator<typeof doStartRegistration>;
  workflow: VerificationCodeStage;
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
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--FailedToCall--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--FailedToCall--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() =>
              startRegistration({ startingPhoneNumber: workflow.phoneNumber })
            }
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--FailedToCall--ok-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function MustWaitDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  waitSubmitDuration,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  waitSubmitDuration: string | undefined;
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
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MustWait--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MustWait--description',
              {
                duration: waitSubmitDuration ?? '',
              }
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--MustWait--button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function CannotSendCodeTemporaryDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  waitSubmitDuration,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  waitSubmitDuration: string | undefined;
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
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodeTemporary--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodeTemporary--description',
              {
                duration: waitSubmitDuration ?? '',
              }
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => setOpen(false)}
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodeTemporary--ok-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function CannotSendCodePermanentDialog({
  // Housekeeping
  i18n,
  isOpen,
  setOpen,
  // Specifics
  startRegistration,
  workflow,
}: {
  // Housekeeping
  i18n: LocalizerType;
  isOpen: boolean;
  setOpen: (value: boolean) => unknown;
  // Specifics
  startRegistration: ActionCreator<typeof doStartRegistration>;
  workflow: VerificationCodeStage;
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
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title screenReaderOnly>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodePermanent--aria-title'
            )}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodePermanent--description'
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() =>
              startRegistration({ startingPhoneNumber: workflow.phoneNumber })
            }
          >
            {i18n(
              'icu:StandaloneRegistration--VerificationCode--CannotSendCodePermanent--ok-button'
            )}
          </AxoConfirmDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
