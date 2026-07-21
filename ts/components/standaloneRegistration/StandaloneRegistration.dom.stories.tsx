// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// oxlint-disable no-console

import { useState } from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta, StoryObj } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n.dom.tsx';
import {
  Direction,
  FatalErrorType,
  RegistrationStage,
} from '../../types/StandaloneRegistration.std.ts';
import { StandaloneRegistration } from './StandaloneRegistration.dom.tsx';

import type {
  CreatePINStage,
  RegistrationWorkflow,
} from '../../types/StandaloneRegistration.std.ts';

import messages from '../../../_locales/en/messages.json';
import { getDefaultAvatars } from '../../types/Avatar.std.ts';
import { MINUTE, SECOND } from '../../util/durations/constants.std.ts';
import { VerificationTransport } from '../../types/VerificationTransport.std.ts';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.std.ts';

const i18n = setupI18n('en', messages);

const meta = {
  component: StandaloneRegistration,
  title: 'Components/StandaloneRegistration',
} satisfies Meta<typeof StandaloneRegistration>;

const phoneNumber = '+14155551111';
const verificationSessionId = 'verification-session-id';

export default meta;
type Story = StoryObj<typeof meta>;

export const StartingScreen: Story = {
  args: {
    // Housekeeping
    conversationId: 'conversationId01',
    countries: [
      {
        region: 'O',
        displayName: 'One',
        code: '+1',
      },
      {
        region: 'T',
        displayName: 'Two',
        code: '+2',
      },
      {
        region: 'Th',
        displayName: 'Three',
        code: '+3',
      },
    ],
    i18n,
    readyForUpdates: action('readyForUpdates'),

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

    // AvatarEditor support
    deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
    replaceAvatar: action('replaceAvatar'),
    saveAvatarToDisk: action('saveAvatarToDisk'),
    userAvatarData: getDefaultAvatars(),
  },
};

export const StartingScreenBackwardAnimation: Story = {
  args: {
    ...StartingScreen.args,
    direction: Direction.BACKWARD,
  },
};

export const StartingScreenPrepopulatedNumber: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.PHONE_NUMBER,
      phoneNumber,
      status: {
        type: 'ready',
      },
    },
  },
};

export const StartingScreenWaiting: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.PHONE_NUMBER,
      status: {
        type: 'waiting',
        readyAt: Date.now() + 30 * SECOND,
      },
    },
  },
};
export const StartingScreenInProgress: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.PHONE_NUMBER,
      phoneNumber,
      status: {
        type: 'in-progress',
      },
    },
  },
};

export const GeneralErrorUpdateRequired: Story = {
  args: {
    ...StartingScreen.args,
    fatalError: FatalErrorType.UPDATE_REQUIRED,
  },
};

export const GeneralErrorConnectivityError: Story = {
  args: {
    ...StartingScreen.args,
    fatalError: FatalErrorType.OFFLINE,
  },
};

export const GeneralErrorUnexpectedError: Story = {
  args: {
    ...StartingScreen.args,
    fatalError: FatalErrorType.UNEXPECTED,
  },
};

export const Captcha: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CAPTCHA,
      captchaCompleteCount: 0,
      phoneNumber,
      status: {
        type: 'ready',
      },
      verificationSessionId,
    },
  },
};

export const CaptchaInProgress: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CAPTCHA,
      captchaCompleteCount: 0,
      phoneNumber,
      status: {
        type: 'in-progress',
        startedAt: Date.now() - 25 * SECOND,
      },
      verificationSessionId,
    },
  },
};

export const CaptchaWithWaitTime: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CAPTCHA,
      captchaCompleteCount: 0,
      phoneNumber,
      verificationSessionId,
      status: {
        type: 'waiting',
        canDoCaptchaAt: Date.now() + MINUTE * 5,
      },
    },
  },
};

export const CaptchaWithAnotherNeeded: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CAPTCHA,
      captchaCompleteCount: 0,
      phoneNumber,
      status: {
        type: 'another-needed',
      },
      verificationSessionId,
    },
  },
};

export const CaptchaWithFailure: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CAPTCHA,
      captchaCompleteCount: 0,
      phoneNumber,
      status: {
        type: 'failed',
      },
      verificationSessionId,
    },
  },
};

export const VerificationCode: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWhileSubmittingCode: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWhileRequestingSMS: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWhileRequestingCall: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWithFailedToSendSMS: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};
export const VerificationCodeWithFailedToCall: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};
export const VerificationCodeWithHavingTrouble: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};
export const VerificationCodeWithMaximumAttempts: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWithAllDelays: Story = {
  args: {
    ...StartingScreen.args,
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
        callCanBeRequestedAt: Date.now() + 40 * SECOND,
        codeCanBeSubmittedAt: Date.now() + 50 * SECOND,
        smsCanBeRequestedAt: Date.now() + 30 * SECOND,
      },
    },
  },
};

export const VerificationCodeWithIncorrectCode: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerificationCodeWithInvalidCode: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};
export const VerificationCodeWithCannotSendCodeTemporary: Story = {
  args: {
    ...StartingScreen.args,
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
        callCanBeRequestedAt: Date.now() + 5 * MINUTE,
        smsCanBeRequestedAt: Date.now() + 5 * MINUTE,
        codeCanBeSubmittedAt: Date.now() + 5 * MINUTE,
      },
      verificationSessionId,
      failedToSendSMS: false,
      failedToCall: false,
    },
  },
};
export const VerificationCodeWithCannotSendCodePermanent: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const ProfileEntry: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};
export const ProfileEntryWithDefaultData: Story = {
  args: {
    ...StartingScreen.args,
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
        phoneNumberDiscoverability: PhoneNumberDiscoverability.NotDiscoverable,
      },
      status: {
        type: 'ready',
      },
    },
  },
};
export const ProfileEntryInProgress: Story = {
  args: {
    ...StartingScreen.args,
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
  },
};

export const VerifyPIN: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'ready',
      },
    },
  },
};
export const VerifyPINInProgress: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'in-progress',
      },
    },
  },
};
export const VerifyPINIncorrectPinTries3: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 3,
    },
  },
};
export const VerifyPINIncorrectPinTries2: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 2,
    },
  },
};
export const VerifyPINIncorrectPinTries1: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 1,
    },
  },
};
export const VerifyPINIncorrectPinTries0: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 0,
    },
  },
};

export const VerifyPINStartingWithTries2: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'ready',
      },
      triesRemaining: 2,
    },
  },
};
export const VerifyPINStartingWithTries1: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'ready',
      },
      triesRemaining: 1,
    },
  },
};

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
};

export const VerifyPINWithReglock: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'ready',
      },
      dataForReglockAccountCreate,
    },
  },
};

export const VerifyPINWithReglockAndIncorrectPinTries5: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 5,
      dataForReglockAccountCreate,
    },
  },
};

export const VerifyPINWithReglockAndIncorrectPinTries3: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 3,
      dataForReglockAccountCreate,
    },
  },
};

export const VerifyPINWithReglockAndIncorrectPinTries1: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 1,
      dataForReglockAccountCreate,
    },
  },
};

export const VerifyPINWithReglockAndIncorrectPinTries0: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'failed',
        error: 'incorrect-pin',
      },
      triesRemaining: 0,
      dataForReglockAccountCreate,
    },
  },
};

export const VerifyPINWithReglockStartingWithTries1: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.VERIFY_PIN,
      status: {
        type: 'ready',
      },
      triesRemaining: 1,
      dataForReglockAccountCreate,
    },
  },
};

export const CreatePIN: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CREATE_PIN,
    },
  },
};
export const CreatePINConfirm: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CREATE_PIN_CONFIRM,
      status: {
        type: 'ready',
      },
      pin: '1234',
    },
  },
};
export const CreatePINConfirmInProgress: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.CREATE_PIN_CONFIRM,
      status: {
        type: 'in-progress',
      },
      pin: '1234',
    },
  },
};

export const AccountLocked: Story = {
  args: {
    ...StartingScreen.args,
    workflow: {
      stage: RegistrationStage.ACCOUNT_LOCKED,
    },
  },
};

export function ProgressionWithVerify(): React.JSX.Element {
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

  const props = {
    ...StartingScreen.args,
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

  return <StandaloneRegistration {...props} />;
}
