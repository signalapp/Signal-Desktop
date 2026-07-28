// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.ts';
import type { VerificationTransport } from './VerificationTransport.std.ts';

// Some example simple workflows:
// - Totally new account creation:
//   PHONE_NUMBER -> CAPTCHA -> VERIFICATION_CODE -> PROFILE_ENTRY -> CREATE_PIN -> CREATE_PIN_CONFIRM -> <complete>
// - Re-registration, with profile and phone from previous registration:
//   PHONE_NUMBER (phone prepopulated) -> CAPTCHA -> VERIFICATION_CODE -> PROFILE_ENTRY (data prepopulated) -> VERIFY_PIN -> <complete>
// - Unable to provide correct verification code:
//   PHONE_NUMBER -> CAPTCHA -> VERIFICATION_CODE -> PHONE_NUMBER (in 'waiting' status)
// - Unable to provide correct PIN:
//   PHONE_NUMBER -> CAPTCHA -> VERIFICATION_CODE -> PROFILE_ENTRY -> VERIFY_PIN -> CREATE_PIN -> CREATE_PIN_CONFIRM -> <complete>
// - Unable to provide correct PIN with reglock:
//   PHONE_NUMBER -> CAPTCHA -> VERIFICATION_CODE -> PROFILE_ENTRY -> VERIFY_PIN -> ACCOUNT_LOCKED -> PHONE_NUMBER

export enum RegistrationStage {
  PHONE_NUMBER = 'PHONE_NUMBER',
  CAPTCHA = 'CAPTCHA',
  VERIFICATION_CODE = 'VERIFICATION_CODE',
  PROFILE_ENTRY = 'PROFILE_ENTRY',
  VERIFY_PIN = 'VERIFY_PIN',
  CREATE_PIN = 'CREATE_PIN',
  CREATE_PIN_CONFIRM = 'CREATE_PIN_CONFIRM',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
}

export const StageOrder: Record<RegistrationStage, number> = {
  [RegistrationStage.PHONE_NUMBER]: 0,
  [RegistrationStage.CAPTCHA]: 1,
  [RegistrationStage.VERIFICATION_CODE]: 2,
  [RegistrationStage.PROFILE_ENTRY]: 3,
  [RegistrationStage.VERIFY_PIN]: 4,
  [RegistrationStage.CREATE_PIN]: 5,
  [RegistrationStage.CREATE_PIN_CONFIRM]: 6,
  [RegistrationStage.ACCOUNT_LOCKED]: 7,
};

// A few special-cases are always allowed:
//   1. You can always return to the initial PHONE_NUMBER stage
//   2. You can only start from the initial PHONE_NUMBER stage
//   3. You can always make an update to the existing stage
export const ValidNextStages: Record<
  RegistrationStage,
  Set<RegistrationStage>
> = {
  [RegistrationStage.PHONE_NUMBER]: new Set([RegistrationStage.CAPTCHA]),
  [RegistrationStage.CAPTCHA]: new Set([RegistrationStage.VERIFICATION_CODE]),
  [RegistrationStage.VERIFICATION_CODE]: new Set([
    RegistrationStage.PROFILE_ENTRY,
    RegistrationStage.ACCOUNT_LOCKED, // if 423 from account create contains no credentials
  ]),
  [RegistrationStage.PROFILE_ENTRY]: new Set([
    RegistrationStage.VERIFY_PIN,
    RegistrationStage.CREATE_PIN,
  ]),
  [RegistrationStage.VERIFY_PIN]: new Set([
    RegistrationStage.CREATE_PIN, // if no reg-lock, can choose to create a new PIN
    RegistrationStage.ACCOUNT_LOCKED,
  ]),
  [RegistrationStage.CREATE_PIN]: new Set([
    RegistrationStage.CREATE_PIN_CONFIRM,
  ]),
  [RegistrationStage.CREATE_PIN_CONFIRM]: new Set([
    RegistrationStage.CREATE_PIN, // so we can go back
  ]),
  [RegistrationStage.ACCOUNT_LOCKED]: new Set([]),
};

// There's no 'complete' stage, just a check we do when we are done
export const ValidStepsBeforeComplete = new Set([
  RegistrationStage.VERIFY_PIN, // successfully verified PIN
  RegistrationStage.CREATE_PIN, // opted out of creating a PIN
  RegistrationStage.CREATE_PIN_CONFIRM, // new PIN successfully created
]);

export enum FatalErrorType {
  OFFLINE = 'OFFLINE',
  UNEXPECTED = 'UNEXPECTED',
  TIMEOUT = 'TIMEOUT',
  UPDATE_REQUIRED = 'UPDATE_REQUIRED',
}

export enum Direction {
  FORWARD = 1,
  BACKWARD = -1,
}

// May come from PROFILE_ENTRY stage, or from prior account info
export type ProfileData = {
  firstName: string;
  lastName?: string;
  avatarData?: Uint8Array<ArrayBuffer>;
  phoneNumberDiscoverability: PhoneNumberDiscoverability;
};

export type PhoneNumberStage = {
  // Where the process starts - first, the user needs to enter a phone number.
  // Prerequisites: <none>
  // Behaviors:
  //   - if phone number is provided in initial state, it will be prepopulated in the UI
  //   - if waitUntil is set, user will need to wait that long until starting process again
  // Completion requirements:
  //   - a valid phone number that user has confirmed
  stage: RegistrationStage.PHONE_NUMBER;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'waiting';
        readyAt: number;
      }
    | {
        type: 'in-progress';
      };

  phoneNumber?: string;
  profileData?: ProfileData;

  // After PHONE_NUMBER:
  //  1. Create a verification session
  //  2. Verify data in session: allowedToRequestCode=false, and requestedInformation includes 'captcha'
};

export type CaptchaStage = {
  // Because Desktop cannot receive push notifications, manual validation is required
  // Prerequisites:
  //   - phone number
  //   - verification session has started
  //   - captcha process has started
  // Behaviors:
  //   - a button to allow user to open the browser again, shown after a delay
  //   - If type=waiting, UI explaining to the user that they need to wait to try another captcha
  //   - If error, tell the user and allow them to try again
  // Completion requirements:
  //   - captcha is completed
  stage: RegistrationStage.CAPTCHA;
  verificationSessionId: string;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'waiting';
        canDoCaptchaAt: number;
      }
    | {
        type: 'in-progress';
        startedAt: number;
      }
    | {
        type: 'another-needed';
      }
    | {
        type: 'failed';
      };

  captchaCompleteCount: number;

  phoneNumber: string;
  profileData?: ProfileData;

  // After CAPTCHA:
  //   1. Update verification session with the token that resulted from the captcha
  //   2. Verify that allowedToRequestCode=true is returned on the session
  //   3. Attempt to request a SMS code - if that fails, set voiceCallNeeded=true
};

export type RawTimings = {
  nextSmsSecs?: number | undefined;
  nextCallSecs?: number | undefined;
  nextVerificationAttemptSecs?: number | undefined;
};
export type Timings = {
  smsCanBeRequestedAt?: number;
  callCanBeRequestedAt?: number;
  codeCanBeSubmittedAt?: number;
};

export type VerificationCodeStage = {
  // We need to verify that the user has access to the target phone number
  // Prerequisites:
  //   - phone number
  //   - timestamp of when the the request to send the code was made
  //   - a boolean telling us whether the server failed in sending the SMS, and a voice call is necessary
  // Behaviors:
  //   - if failedToSendSMS=true, immediately pop a dialog saying that we couldn't send sms
  //   - after a 1-minute timer, can request to have the code resent, or get a voice call
  //   - after too many incorrect PIN attempts, dialog allows user to request code resend
  //   - after too many resends and incorrect PIN attempts, process is started over with waitNeeded set
  // Completion requirements:
  //   - user has entered the proper code
  stage: RegistrationStage.VERIFICATION_CODE;
  verificationSessionId: string;

  timings?: Timings;

  failedToSendSMS: boolean;
  failedToCall: boolean;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'requesting-code';
        transport: VerificationTransport;
      }
    | {
        type: 'submitting-code';
      }
    | {
        type: 'failed';
        error:
          | 'cannot-send-code-permanent'
          | 'cannot-send-code-temporary'
          | 'incorrect-code'
          | 'invalid-code';
      };

  codeSendCount: number;
  failedSubmitCodeCount: number;

  phoneNumber: string;
  profileData?: ProfileData;

  // After VERIFICATION_CODE:
  //   1. Submit the verification code on the session
  //   2. Ensure that session has verified=true
  //   3. Create the account, using the verification session id (with skipDeviceTransfer=true)
  //     - If we get a 423, we know the account has a reglock, and we need to harvest SVR credentials from that response
  //     - If we get a 200, and result has storageCapable=true that means user has data in SVR

  // If we have no profile information from prior account info, go to PROFILE_ENTRY
  // else if storageCapable=true, go to VERIFY_PIN
  // else go to CREATE_PIN
};

// Fetched after account is created, or from a failed account create due to reglock (code 423)
type SVRCredentials = {
  username: string;
  password: string;
};

export type LateStageAccountState =
  | {
      created: true;
      hasPin: boolean;
    }
  | {
      created: false;
      phoneNumber: string;
      verificationSessionId: string;
      svrCredentials: SVRCredentials;
    };

export type ProfileEntryStage = {
  // If we don't have information from a prior registration, the user sets up a profile
  // Prerequisites:
  //   - none; we could easily move this stage around
  //   - if we already have profile information, this stage can be skipped
  // Behaviors:
  //   - we should save all of the draft avatars the user created but didn't use
  // Completion requirements:
  //   - only first name is required
  stage: RegistrationStage.PROFILE_ENTRY;

  // Prepopulates fields; so user has a chance to modify their details if they want
  profileData?: ProfileData;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'in-progress';
      };

  // If we get a 423, we can't create the user's account until after the right PIN is entered!
  accountState: LateStageAccountState;

  // After PROFILE_ENTRY:
  //  1. if accountState.created=true, can upload profile here since account is created
  //  2. if accountState.created=false or accountState.hasPin=true, go to VERIFY_PIN. Otherwise, CREATE_PIN.
};

export type VerifyPINStage = {
  // Server has told us that this account has a PIN, the user needs to enter the right one!
  // Prerequisites:
  //   - hasPIN=true or account not created yet
  //   - full profile information is ready to be uploaded
  // Behaviors:
  //   - if there are too many incorrect attempts show red text, then dialog
  //   - if account does not have reglock, and too many attempts, can reset state via CREATE_PIN
  //   - if account has reglock and too many attempts, go to ACCOUNT_LOCKED stage
  // Completion requirements:
  //   - correct PIN was entered
  stage: RegistrationStage.VERIFY_PIN;

  dataForReglockAccountCreate?: DataForReglockAccountCreate;

  triesRemaining?: number;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'in-progress';
      }
    | { type: 'failed'; error: 'incorrect-pin' };

  // After VERIFY_PIN:
  //  - save PIN in local storage
  //  - if accountState.created=false, fetch data from SVR, create account with proper reglock data, upload profile info, then <complete>
  //  - otherwise fetch data from SVR and initialize storage service with it, then <complete>
};

export type CreatePINStage = {
  // If server tells us there was no PIN for this user, we will have them create a new one
  // Prerequisites:
  //   - profile has been updated
  //   - account is already created, and hasPIN=false
  // Behaviors:
  //   - an initial entry screen
  // Completion requirements:
  //   - a valid PIN has been entered
  stage: RegistrationStage.CREATE_PIN;

  // Go to CREATE_PIN_CONFIRM
};

export type CreatePINConfirmStage = {
  // If server tells us there was no PIN for this user, we will have them create a new one
  // Prerequisites:
  //   - profile has been updated
  //   - account is already created, and hasPIN=false
  //   - initial new PIN has been created
  // Behaviors:
  //   - the second part, a confirmation screen
  //   - once this is done, the registration process is complete!
  // Completion requirements:
  //   - a valid PIN has been entered which matches the previous PIN
  stage: RegistrationStage.CREATE_PIN_CONFIRM;

  pin: string;

  status:
    | {
        type: 'ready';
      }
    | {
        type: 'in-progress';
      };

  // After CREATE_PIN_CONFIRM
  //  1. initialize storage service, generating keys
  //  3. Save PIN and key in local storage
  //  3. Go to COMPLETE
};

export type DataForReglockAccountCreate = {
  phoneNumber: string;
  verificationSessionId: string;
  svrCredentials: SVRCredentials;
  profileData: ProfileData;
};

export type AccountLockedStage = {
  // Server has told us that the phone number in question is locked (reglock and no more PIN tries)
  // Prerequisites:
  //   - server has told us that this account is locked - earlier stages can let us know about this as well
  // Behaviors:
  //   - user can try again with a different phone number
  stage: RegistrationStage.ACCOUNT_LOCKED;
};

export type RegistrationWorkflow =
  | PhoneNumberStage
  | CaptchaStage
  | VerificationCodeStage
  | ProfileEntryStage
  | VerifyPINStage
  | CreatePINStage
  | CreatePINConfirmStage
  | AccountLockedStage;
