// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import type { JSX } from 'react';

import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { TitlebarDragArea } from '../TitlebarDragArea.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import {
  FatalErrorType,
  RegistrationStage,
} from '../../types/StandaloneRegistration.std.ts';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { PhoneNumberScreen } from './stages/PhoneNumber.dom.tsx';
import { CaptchaScreen } from './stages/Captcha.dom.tsx';
import { VerificationCodeScreen } from './stages/VerificationCode.dom.tsx';
import { ProfileEntryScreen } from './stages/ProfileEntry.dom.tsx';
import { VerifyPINScreen } from './stages/VerifyPIN.dom.tsx';
import { CreatePINScreen } from './stages/CreatePIN.dom.tsx';
import { CreatePINConfirmScreen } from './stages/CreatePINConfirm.dom.tsx';
import { AccountLockedScreen } from './stages/AccountLocked.dom.tsx';
import { Spacer } from './util/StepComponents.dom.tsx';
import { CONTACT_SUPPORT_URL } from '../../util/contactSupport.dom.tsx';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';

import type { LocalizerType } from '../../types/I18N.std.ts';
import type { ActionCreator } from '../../state/types.std.ts';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../types/Avatar.std.ts';
import type {
  Direction,
  RegistrationWorkflow,
} from '../../types/StandaloneRegistration.std.ts';
import type {
  completeRegistration as doCompleteRegistration,
  createPIN as doCreatePIN,
  finishProfileEntryStage as doFinishProfileEntryStage,
  goToAccountLockedStage as doGoToAccountLockedStage,
  goToCreatePINStage as doGoToCreatePINStage,
  moveToCaptchaStage as doMoveToCaptchaStage,
  moveToVerificationStage as doMoveToVerificationStage,
  openBrowserForCaptcha as doOpenBrowserForCaptcha,
  requestVerificationCode as doRequestVerificationCode,
  startConfirmingPIN as doStartConfirmingPIN,
  startRegistration as doStartRegistration,
  submitVerificationCode as doSubmitVerificationCode,
  verifyPIN as doVerifyPIN,
} from '../../state/ducks/standaloneInstaller.preload.ts';
import type { CountryDataType } from '../../util/getCountryData.dom.ts';

const SPRING = {
  type: 'spring' as const,
  damping: 40,
  stiffness: 401,
  duration: 300,
};
const ANIMATION_X_OFFSET = 200;

export type PropsType = Readonly<{
  // Housekeeping
  conversationId?: string;
  countries: ReadonlyArray<CountryDataType>;
  i18n: LocalizerType;
  readyForUpdates: () => void;

  // The workflow
  cancelRegistration: () => unknown;
  completeRegistration: ActionCreator<typeof doCompleteRegistration>;
  createPIN: ActionCreator<typeof doCreatePIN>;
  direction: Direction;
  fatalError: FatalErrorType | undefined;
  finishProfileEntryStage: ActionCreator<typeof doFinishProfileEntryStage>;
  goToAccountLockedStage: ActionCreator<typeof doGoToAccountLockedStage>;
  goToCreatePINStage: ActionCreator<typeof doGoToCreatePINStage>;
  moveToCaptchaStage: ActionCreator<typeof doMoveToCaptchaStage>;
  moveToVerificationStage: ActionCreator<typeof doMoveToVerificationStage>;
  openBrowserForCaptcha: ActionCreator<typeof doOpenBrowserForCaptcha>;
  requestVerificationCode: ActionCreator<typeof doRequestVerificationCode>;
  startRegistration: ActionCreator<typeof doStartRegistration>;
  startConfirmingPIN: ActionCreator<typeof doStartConfirmingPIN>;
  submitVerificationCode: ActionCreator<typeof doSubmitVerificationCode>;
  verifyPIN: ActionCreator<typeof doVerifyPIN>;
  workflow: RegistrationWorkflow;

  // AvatarEditor support
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  userAvatarData: ReadonlyArray<AvatarDataType>;
}>;

export function StandaloneRegistration({
  // Housekeeping
  conversationId,
  countries,
  i18n,
  readyForUpdates,

  // The workflow
  cancelRegistration,
  completeRegistration,
  createPIN,
  direction,
  fatalError,
  finishProfileEntryStage,
  goToAccountLockedStage,
  goToCreatePINStage,
  moveToCaptchaStage,
  moveToVerificationStage,
  openBrowserForCaptcha,
  requestVerificationCode,
  startConfirmingPIN,
  startRegistration,
  submitVerificationCode,
  verifyPIN,
  workflow,

  // AvatarEditor support
  deleteAvatarFromDisk,
  replaceAvatar,
  saveAvatarToDisk,
  userAvatarData,
}: PropsType): JSX.Element {
  useEffect(() => {
    readyForUpdates();
  }, [readyForUpdates]);

  const [updateRequiredDialogOpen, setUpdateRequiredDialogOpen] =
    useState(false);
  const [connectivityErrorDialogOpen, setConnectivityErrorDialogOpen] =
    useState(false);
  const [unexpectedErrorDialogOpen, setUnexpectedErrorDialogOpen] =
    useState(false);

  const previousFatalError = useRef<FatalErrorType>(undefined);
  // oxlint-disable-next-line react/refs
  if (fatalError !== previousFatalError.current) {
    // oxlint-disable-next-line react/refs
    previousFatalError.current = fatalError;

    if (!fatalError) {
      // do nothing
    } else if (fatalError === FatalErrorType.UPDATE_REQUIRED) {
      setUpdateRequiredDialogOpen(true);
    } else if (
      fatalError === FatalErrorType.TIMEOUT ||
      fatalError === FatalErrorType.OFFLINE
    ) {
      setConnectivityErrorDialogOpen(true);
    } else if (fatalError === FatalErrorType.UNEXPECTED) {
      setUnexpectedErrorDialogOpen(true);
    } else {
      throw missingCaseError(fatalError);
    }
  }

  let body: JSX.Element;
  if (workflow.stage === RegistrationStage.PHONE_NUMBER) {
    body = (
      <PhoneNumberScreen
        i18n={i18n}
        moveToCaptchaStage={moveToCaptchaStage}
        cancelRegistration={cancelRegistration}
        countries={countries}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.CAPTCHA) {
    body = (
      <CaptchaScreen
        i18n={i18n}
        moveToVerificationStage={moveToVerificationStage}
        openBrowserForCaptcha={openBrowserForCaptcha}
        startRegistration={startRegistration}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.VERIFICATION_CODE) {
    body = (
      <VerificationCodeScreen
        i18n={i18n}
        requestVerificationCode={requestVerificationCode}
        startRegistration={startRegistration}
        submitVerificationCode={submitVerificationCode}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.PROFILE_ENTRY) {
    body = (
      <ProfileEntryScreen
        conversationId={conversationId}
        finishProfileEntryStage={finishProfileEntryStage}
        i18n={i18n}
        workflow={workflow}
        // ProfileEditor support
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        replaceAvatar={replaceAvatar}
        saveAvatarToDisk={saveAvatarToDisk}
        userAvatarData={userAvatarData}
      />
    );
  } else if (workflow.stage === RegistrationStage.VERIFY_PIN) {
    body = (
      <VerifyPINScreen
        verifyPIN={verifyPIN}
        goToCreatePINStage={goToCreatePINStage}
        goToAccountLockedStage={goToAccountLockedStage}
        i18n={i18n}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.CREATE_PIN) {
    body = (
      <CreatePINScreen
        completeRegistration={completeRegistration}
        i18n={i18n}
        startConfirmingPIN={startConfirmingPIN}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.CREATE_PIN_CONFIRM) {
    body = (
      <CreatePINConfirmScreen
        goToCreatePINStage={goToCreatePINStage}
        createPIN={createPIN}
        i18n={i18n}
        workflow={workflow}
      />
    );
  } else if (workflow.stage === RegistrationStage.ACCOUNT_LOCKED) {
    body = (
      <AccountLockedScreen i18n={i18n} startRegistration={startRegistration} />
    );
  } else {
    throw missingCaseError(workflow);
  }

  return (
    <div
      className={tw(
        'flex size-full flex-col overflow-hidden bg-[url("../images/registration-background.png")] bg-cover bg-center'
      )}
    >
      <TitlebarDragArea />
      <img
        className="StandaloneRegistration--SignalLogo"
        src="images/signal-logo-with-text.svg"
        alt={i18n('icu:StandaloneRegistration--signal-logo')}
      />
      <Spacer className={tw('h-8')} />
      <div className={tw('relative grow')}>
        <div
          className={tw(
            'absolute inset-s-1/2 top-1/2 flex max-h-[calc(100%-32px)] w-143 max-w-[calc(100%-32px)] -translate-1/2 transform flex-col overflow-hidden rounded-[26px] bg-surface-primary'
          )}
        >
          <AnimatePresence>
            <motion.div
              initial={{
                x: ANIMATION_X_OFFSET * direction,
                opacity: 0,
              }}
              animate={{ x: 0, opacity: 1 }}
              key={workflow.stage}
              transition={SPRING}
              className={tw(
                'flex size-full grow flex-col overflow-x-hidden overflow-y-scroll p-6'
              )}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AxoConfirmDialog.Root
        open={updateRequiredDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setUpdateRequiredDialogOpen(false);
          }
        }}
        title={i18n('icu:StandaloneRegistration--UpdateRequired--header')}
        description={i18n(
          'icu:StandaloneRegistration--UpdateRequired--description'
        )}
      >
        <AxoConfirmDialog.Action
          variant="strong-secondary"
          onClick={() => cancelRegistration()}
        >
          {i18n('icu:StandaloneRegistration--UpdateRequired--cancel')}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => {
            // TODO: kick off update process - how to represent this during updates?
          }}
        >
          {i18n('icu:StandaloneRegistration--UpdateRequired--update')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <AxoConfirmDialog.Root
        open={connectivityErrorDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setConnectivityErrorDialogOpen(false);
          }
        }}
        title={i18n('icu:StandaloneRegistration--ConnectionProblem--header')}
        description={i18n(
          'icu:StandaloneRegistration--ConnectionProblem--description'
        )}
      >
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => {
            // Just dismiss dialog; the user can try again on whatever screen they were on
            setConnectivityErrorDialogOpen(false);
          }}
        >
          {i18n('icu:StandaloneRegistration--ConnectionProblem--button')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <AxoConfirmDialog.Root
        open={unexpectedErrorDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setUnexpectedErrorDialogOpen(false);
          }
        }}
        title={i18n('icu:StandaloneRegistration--UnexpectedError--header')}
        description={i18n(
          'icu:StandaloneRegistration--UnexpectedError--description'
        )}
      >
        <AxoConfirmDialog.Action
          variant="strong-secondary"
          onClick={() => {
            openLinkInWebBrowser(CONTACT_SUPPORT_URL);
          }}
        >
          {i18n(
            'icu:StandaloneRegistration--UnexpectedError--contact-support-button'
          )}
        </AxoConfirmDialog.Action>
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => startRegistration()}
        >
          {i18n(
            'icu:StandaloneRegistration--UnexpectedError--try-again-button'
          )}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </div>
  );
}
