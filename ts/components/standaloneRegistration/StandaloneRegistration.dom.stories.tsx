// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// oxlint-disable no-console

import { useContext, useState } from 'react';
import { action } from '@storybook/addon-actions';

import type { JSX } from 'react';
import type { Meta } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n.dom.tsx';
import {
  Direction,
  FatalErrorType,
  RegistrationStage,
} from '../../types/StandaloneRegistration.std.ts';
import { StandaloneRegistration } from './StandaloneRegistration.dom.tsx';
import messages from '../../../_locales/en/messages.json';
import { getDefaultAvatars } from '../../types/Avatar.std.ts';
import { MINUTE, SECOND } from '../../util/durations/constants.std.ts';
import { VerificationTransport } from '../../types/VerificationTransport.std.ts';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.std.ts';
import { DialogType } from '../../types/Dialogs.std.ts';

import type {
  CreatePINStage,
  RegistrationWorkflow,
} from '../../types/StandaloneRegistration.std.ts';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.ts';
import type { PropsType } from './StandaloneRegistration.dom.tsx';

const i18n = setupI18n('en', messages);

export default {
  component: StandaloneRegistration,
  title: 'Components/StandaloneRegistration',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    Story => {
      return (
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof StandaloneRegistration>;

const phoneNumber = '+14155551111';
const verificationSessionId = 'verification-session-id';
const now = Date.now();

const useProps = (): PropsType => ({
  // Housekeeping
  conversationId: 'conversationId01',
  countries: [
    {
      region: 'US',
      displayName: 'United States',
      code: '+1',
    },
    {
      region: 'FR',
      displayName: 'France',
      code: '+33',
    },
    {
      region: 'GB',
      displayName: 'United Kingdom',
      code: '+44',
    },
  ],
  i18n,
  readyForUpdates: action('readyForUpdates'),
  theme: useContext(StorybookThemeContext),

  // The workflow
  cancelRegistration: action('cancelRegistration'),
  completeRegistration: action('completeRegistration'),
  createPIN: action('createPIN'),
  direction: Direction.FORWARD,
  fatalError: undefined,
  finishProfileEntryStage: action('finishProfileEntryStage'),
  goToAccountLockedStage: action('goToAccountLockedStage'),
  goToCreatePINStage: action('goToCreatePINStage'),
  moveToCaptchaStage: action('moveToCaptchaStage'),
  moveToVerificationStage: action('moveToVerificationStage'),
  openBrowserForCaptcha: action('openBrowserForCaptcha'),
  requestVerificationCode: action('requestVerificationCode'),
  startConfirmingPIN: action('startConfirmingPIN'),
  startRegistration: action('startRegistration'),
  submitVerificationCode: action('submitVerificationCode'),
  verifyPIN: action('verifyPIN'),
  workflow: {
    stage: RegistrationStage.PHONE_NUMBER,
    status: {
      type: 'ready',
    },
  },

  // Updates
  currentVersion: 'v1.0.0',
  forceCheck: action('forceCheck'),
  kickOffForcedUpgrade: action('kickOffForcedUpgrade'),
  OS: 'windows',
  startUpdate: action('startUpdate'),
  updates: {
    dialogType: DialogType.None,
    didSnooze: false,
    showEventsCount: 0,
    isCheckingForUpdates: false,
  },

  // AvatarEditor support
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  userAvatarData: getDefaultAvatars(),
});

export function StartingScreen(): JSX.Element {
  const props = useProps();
  return <StandaloneRegistration {...props} />;
}

export function StartingScreenBackwardAnimation(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration {...props} {...{ direction: Direction.BACKWARD }} />
  );
}

export function StartingScreenPrepopulatedNumber(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PHONE_NUMBER,
          phoneNumber,
          status: {
            type: 'ready',
          },
        },
      }}
    />
  );
}

export function StartingScreenWaiting(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PHONE_NUMBER,
          status: {
            type: 'waiting',
            readyAt: now + 30 * SECOND,
          },
        },
      }}
    />
  );
}
export function StartingScreenInProgress(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PHONE_NUMBER,
          phoneNumber,
          status: {
            type: 'in-progress',
          },
        },
      }}
    />
  );
}

export function GeneralErrorUpdateRequired(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        fatalError: FatalErrorType.UPDATE_REQUIRED,
      }}
    />
  );
}

export function GeneralErrorConnectivityError(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{ fatalError: FatalErrorType.OFFLINE }}
    />
  );
}

export function GeneralErrorUnexpectedError(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{ fatalError: FatalErrorType.UNEXPECTED }}
    />
  );
}

export function Captcha(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CAPTCHA,
          captchaCompleteCount: 0,
          phoneNumber,
          status: {
            type: 'ready',
          },
          verificationSessionId,
        },
      }}
    />
  );
}

export function CaptchaInProgress(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CAPTCHA,
          captchaCompleteCount: 0,
          phoneNumber,
          status: {
            type: 'in-progress',
            startedAt: now - 25 * SECOND,
          },
          verificationSessionId,
        },
      }}
    />
  );
}

export function CaptchaWithWaitTime(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CAPTCHA,
          captchaCompleteCount: 0,
          phoneNumber,
          verificationSessionId,
          status: {
            type: 'waiting',
            canDoCaptchaAt: now + MINUTE * 5,
          },
        },
      }}
    />
  );
}

export function CaptchaWithAnotherNeeded(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CAPTCHA,
          captchaCompleteCount: 0,
          phoneNumber,
          status: {
            type: 'another-needed',
          },
          verificationSessionId,
        },
      }}
    />
  );
}

export function CaptchaWithFailure(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CAPTCHA,
          captchaCompleteCount: 0,
          phoneNumber,
          status: {
            type: 'failed',
          },
          verificationSessionId,
        },
      }}
    />
  );
}

export function VerificationCode(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'ready',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWhileSubmittingCode(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'submitting-code',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWhileRequestingSMS(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'requesting-code',
            transport: VerificationTransport.SMS,
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWhileRequestingCall(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'requesting-code',
            transport: VerificationTransport.Voice,
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWithFailedToSendSMS(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'ready',
          },
          verificationSessionId,
          failedToSendSMS: true,
          failedToCall: false,
        },
      }}
    />
  );
}
export function VerificationCodeWithFailedToCall(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'ready',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: true,
        },
      }}
    />
  );
}
export function VerificationCodeWithHavingTrouble(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 3,
          status: {
            type: 'ready',
          },
          phoneNumber,
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}
export function VerificationCodeWithMaximumAttempts(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 5,
          status: {
            type: 'ready',
          },
          phoneNumber,
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWithAllDelays(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'ready',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
          timings: {
            callCanBeRequestedAt: now + 40 * SECOND,
            codeCanBeSubmittedAt: now + 50 * SECOND,
            smsCanBeRequestedAt: now + 30 * SECOND,
          },
        },
      }}
    />
  );
}

export function VerificationCodeWithIncorrectCode(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'failed',
            error: 'incorrect-code',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function VerificationCodeWithInvalidCode(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'failed',
            error: 'invalid-code',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}
export function VerificationCodeWithCannotSendCodeTemporary(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'failed',
            error: 'cannot-send-code-temporary',
          },
          timings: {
            callCanBeRequestedAt: now + 5 * MINUTE,
            smsCanBeRequestedAt: now + 5 * MINUTE,
            codeCanBeSubmittedAt: now + 5 * MINUTE,
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}
export function VerificationCodeWithCannotSendCodePermanent(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFICATION_CODE,
          codeSendCount: 0,
          failedSubmitCodeCount: 0,
          phoneNumber,
          status: {
            type: 'failed',
            error: 'cannot-send-code-permanent',
          },
          verificationSessionId,
          failedToSendSMS: false,
          failedToCall: false,
        },
      }}
    />
  );
}

export function ProfileEntry(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PROFILE_ENTRY,
          accountState: {
            created: true,
            hasPin: false,
          },
          status: {
            type: 'ready',
          },
        },
      }}
    />
  );
}
export function ProfileEntryWithDefaultData(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PROFILE_ENTRY,
          accountState: {
            created: true,
            hasPin: false,
          },
          profileData: {
            firstName: 'John',
            lastName: 'Wick',
            avatarData: undefined,
            phoneNumberDiscoverability:
              PhoneNumberDiscoverability.NotDiscoverable,
          },
          status: {
            type: 'ready',
          },
        },
      }}
    />
  );
}
export function ProfileEntryInProgress(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.PROFILE_ENTRY,
          accountState: {
            created: true,
            hasPin: false,
          },
          status: {
            type: 'in-progress',
          },
        },
      }}
    />
  );
}

export function VerifyPIN(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'ready',
          },
        },
      }}
    />
  );
}
export function VerifyPINInProgress(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'in-progress',
          },
        },
      }}
    />
  );
}
export function VerifyPINIncorrectPinTries3(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 3,
        },
      }}
    />
  );
}
export function VerifyPINIncorrectPinTries2(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 2,
        },
      }}
    />
  );
}
export function VerifyPINIncorrectPinTries1(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 1,
        },
      }}
    />
  );
}
export function VerifyPINIncorrectPinTries0(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 0,
        },
      }}
    />
  );
}

export function VerifyPINStartingWithTries2(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'ready',
          },
          triesRemaining: 2,
        },
      }}
    />
  );
}
export function VerifyPINStartingWithTries1(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'ready',
          },
          triesRemaining: 1,
        },
      }}
    />
  );
}

const dataForReglockAccountCreate = {
  phoneNumber,
  verificationSessionId,
  svrCredentials: {
    username: 'fake-username',
    password: 'fake-password',
  },
  profileData: {
    firstName: 'John',
    phoneNumberDiscoverability: PhoneNumberDiscoverability.Discoverable,
  },
  avatars: [],
};

export function VerifyPINWithReglock(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'ready',
          },
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function VerifyPINWithReglockAndIncorrectPinTries5(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 5,
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function VerifyPINWithReglockAndIncorrectPinTries3(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 3,
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function VerifyPINWithReglockAndIncorrectPinTries1(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 1,
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function VerifyPINWithReglockAndIncorrectPinTries0(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'failed',
            error: 'incorrect-pin',
          },
          triesRemaining: 0,
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function VerifyPINWithReglockStartingWithTries1(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.VERIFY_PIN,
          status: {
            type: 'ready',
          },
          triesRemaining: 1,
          dataForReglockAccountCreate,
        },
      }}
    />
  );
}

export function CreatePIN(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CREATE_PIN,
        },
      }}
    />
  );
}
export function CreatePINConfirm(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CREATE_PIN_CONFIRM,
          status: {
            type: 'ready',
          },
          pin: '1234',
        },
      }}
    />
  );
}
export function CreatePINConfirmInProgress(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.CREATE_PIN_CONFIRM,
          status: {
            type: 'in-progress',
          },
          pin: '1234',
        },
      }}
    />
  );
}

export function AccountLocked(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.ACCOUNT_LOCKED,
        },
      }}
    />
  );
}

export function UpdateRequiredWithDownloadingState(): JSX.Element {
  const props = useProps();
  return (
    <StandaloneRegistration
      {...props}
      {...{
        workflow: {
          stage: RegistrationStage.UPDATE_REQUIRED,
        },
        updates: {
          ...props.updates,
          dialogType: DialogType.Downloading,
          downloadedSize: 50_000_000,
          downloadSize: 60_000_000,
        },
      }}
    />
  );
}

export function ProgressionWithVerify(): React.JSX.Element {
  const props = useProps();
  const [workflow, setWorkflow] = useState<RegistrationWorkflow | undefined>({
    stage: RegistrationStage.PHONE_NUMBER,
    phoneNumber,
    status: {
      type: 'ready',
    },
  });
  const [direction, setDirection] = useState<Direction>(Direction.FORWARD);

  if (!workflow) {
    return <div>Worklow is undefined!</div>;
  }

  const updatedProps = {
    ...props,
    workflow,
    direction,
    cancelRegistration: (...params: Array<unknown>) => {
      console.log('cancelRegistration', params);
      setWorkflow(undefined);
    },
    startRegistration: async (...params: Array<unknown>) => {
      console.log('startRegistration', params);
      if (workflow) {
        setDirection(Direction.BACKWARD);
      }
      setWorkflow({
        stage: RegistrationStage.PHONE_NUMBER,
        phoneNumber,
        status: {
          type: 'ready',
        },
      });
    },
    moveToCaptchaStage: async (...params: Array<unknown>) => {
      console.log('moveToCaptchaStage', params);
      setDirection(Direction.FORWARD);
      setWorkflow({
        stage: RegistrationStage.CAPTCHA,
        captchaCompleteCount: 0,
        phoneNumber,
        status: {
          type: 'ready',
        },
        verificationSessionId,
      });
    },
    moveToVerificationStage: async (...params: Array<unknown>) => {
      console.log('moveToVerificationStage', params);
      setWorkflow({
        stage: RegistrationStage.VERIFICATION_CODE,
        codeSendCount: 0,
        failedSubmitCodeCount: 0,
        phoneNumber,
        status: {
          type: 'ready',
        },
        verificationSessionId,
        failedToSendSMS: false,
        failedToCall: false,
      });
    },
    openBrowserForCaptcha: async (...params: Array<unknown>) => {
      console.log('openBrowserForCaptcha', params);
    },
    requestVerificationCode: async (...params: Array<unknown>) => {
      console.log('requestVerificationCode', params);
    },
    submitVerificationCode: async (...params: Array<unknown>) => {
      console.log('submitVerificationCode', params);
      setWorkflow({
        stage: RegistrationStage.PROFILE_ENTRY,
        accountState: {
          created: true,
          hasPin: true,
        },
        status: {
          type: 'ready',
        },
      });
    },
    finishProfileEntryStage: async (...params: Array<unknown>) => {
      console.log('finishProfileEntryStage', params);
      setWorkflow({
        stage: RegistrationStage.VERIFY_PIN,
        status: {
          type: 'ready',
        },
      });
    },
    goToCreatePINStage: async (...params: Array<unknown>) => {
      console.log('goToCreatePINStage', params);
      setWorkflow({
        stage: RegistrationStage.CREATE_PIN,
      });
    },
    verifyPIN: async (...params: Array<unknown>) => {
      console.log('verifyPIN', params);
      setWorkflow(undefined);
    },
    startConfirmingPIN: ({
      pin,
      workflow: previousWorkflow,
    }: {
      pin: string;
      workflow: CreatePINStage;
    }) => {
      console.log('startConfirmingPIN', { pin, workflow });
      setWorkflow({
        ...previousWorkflow,
        stage: RegistrationStage.CREATE_PIN_CONFIRM,
        status: { type: 'ready' },
        pin,
      });
    },
    createPIN: async (...params: Array<unknown>) => {
      console.log('createPIN', params);
      setWorkflow(undefined);
    },
    goToAccountLockedStage: async (...params: Array<unknown>) => {
      console.log('goToAccountLockedStage', params);
      setWorkflow({
        stage: RegistrationStage.ACCOUNT_LOCKED,
      });
    },
    completeRegistration: async (...params: Array<unknown>) => {
      console.log('completeRegistration', params);
      setWorkflow(undefined);
    },
  };

  return <StandaloneRegistration {...updatedProps} />;
}
