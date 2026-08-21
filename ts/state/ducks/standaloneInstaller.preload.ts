// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import { v7 as generateUuid } from 'uuid';
import { SvrKey } from '@signalapp/libsignal-client/dist/AccountKeys';

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { SECOND } from '../../util/durations/constants.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { drop } from '../../util/drop.std.ts';
import { toBase64, toHex } from '../../Bytes.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { getChallengeURL } from '../../challenge.dom.ts';
import { challengeHandler } from '../../services/challengeHandler.preload.ts';
import { accountManager } from '../../textsecure/AccountManager.preload.ts';
import {
  createVerificationSession,
  requestCodeForVerificationSession,
  restoreFromSVR2,
  submitCaptchaForVerificationSession,
  submitCodeForVerificationSession,
} from '../../textsecure/WebAPI.preload.ts';
import { VerificationTransport } from '../../types/VerificationTransport.std.ts';
import {
  Direction,
  PartialRegistrationType,
  RegistrationStage,
  StageOrder,
  ValidNextStages,
  ValidStepsBeforeComplete,
} from '../../types/StandaloneRegistration.std.ts';
import { ErrorCode, LibSignalErrorBase } from '@signalapp/libsignal-client';
import {
  SessionNotAllowedToRequestCodeError,
  SessionNotVerifiedError,
} from '../../textsecure/Errors.std.ts';
import { openInbox } from './app.preload.ts';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import {
  disableStorageService,
  enableStorageService,
} from '../../services/storage.preload.ts';
import { assertDev } from '../../util/assert.std.ts';
import { FatalErrorType } from '../../types/StandaloneRegistration.std.ts';
import {
  deleteAvatar,
  readAttachmentData,
  writeNewAvatarData,
} from '../../util/migrations.preload.ts';
import { registrationJobQueue } from '../../jobs/registrationJobQueue.preload.ts';
import { filterAvatarData, getNextAvatarId } from './conversations.preload.ts';
import { DataWriter } from '../../sql/Client.preload.ts';

import type {
  AccountLockedStage,
  CaptchaStage,
  CreatePINConfirmStage,
  CreatePINStage,
  LateStageAccountState,
  PhoneNumberStage,
  ProfileData,
  ProfileEntryStage,
  RawTimings,
  RegistrationWorkflow,
  Timings,
  VerificationCodeStage,
  VerifyPINStage,
} from '../../types/StandaloneRegistration.std.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import type { StateType } from '../reducer.preload.ts';
import type { OpenInboxActionType } from './app.preload.ts';
import type { RestoreResponseType } from '../../textsecure/WebAPI.preload.ts';
import type { NoopActionType } from './noop.std.ts';
import type { AvatarDataType } from '../../types/Avatar.std.ts';
import { normalizePin } from '../../util/normalizePin.std.ts';

const log = createLogger('ducks/standaloneInstaller');

export const UPDATE_WORKFLOW = 'standaloneInstaller/UPDATE_WORKFLOW';
export const CANCEL_WORKFLOW = 'standaloneInstaller/CANCEL_WORKFLOW';

export type UpdateWorkflowActionType = ReadonlyDeep<{
  type: typeof UPDATE_WORKFLOW;
  payload: {
    workflow: RegistrationWorkflow | undefined;
    fatalError?: FatalErrorType;
  };
}>;

export type CancelWorkflowActionType = ReadonlyDeep<{
  type: typeof CANCEL_WORKFLOW;
}>;

export type StandaloneInstallerActionType = ReadonlyDeep<
  CancelWorkflowActionType | UpdateWorkflowActionType
>;

// Steps

function updateWorkflow(
  workflow: RegistrationWorkflow,
  fatalError?: FatalErrorType
): UpdateWorkflowActionType {
  return {
    type: UPDATE_WORKFLOW,
    payload: { workflow, fatalError },
  };
}

export async function getProfileData(
  phoneNumberDiscoverability: PhoneNumberDiscoverability
): Promise<ProfileData | undefined> {
  const me = window.ConversationController.getOurConversation();

  const firstName = me?.get('profileName');
  const lastName = me?.get('profileFamilyName');
  const profileAvatar = me?.get('profileAvatar');
  let avatarData: Uint8Array<ArrayBuffer> | undefined;
  try {
    avatarData = profileAvatar?.url
      ? await readAttachmentData(profileAvatar)
      : undefined;
  } catch (error) {
    log.error(
      `getProfileData: Unable to get avatar data: ${toLogFormat(error)}`
    );
  }

  return firstName
    ? {
        firstName,
        lastName,
        avatarData,
        phoneNumberDiscoverability,
      }
    : undefined;
}

export function startRegistration({
  blankPhoneNumber,
  startingPhoneNumber,
  waitUntil,
}: {
  blankPhoneNumber?: boolean;
  startingPhoneNumber?: string;
  waitUntil?: number;
} = {}): ThunkAction<
  Promise<void>,
  StateType,
  unknown,
  UpdateWorkflowActionType
> {
  return async (dispatch, getState) => {
    const logId =
      `startRegistration(waitUntil=${waitUntil}, ` +
      `startingPhoneNumber=${Boolean(startingPhoneNumber)}, ` +
      `blankPhoneNumber=${Boolean(blankPhoneNumber)})`;
    log.info(logId);

    const items = getState().items;
    const phoneNumberDiscoverability =
      items.phoneNumberDiscoverability ??
      PhoneNumberDiscoverability.Discoverable;
    const profileData = await getProfileData(phoneNumberDiscoverability);

    const me = window.ConversationController.getOurConversation();

    const workflow: PhoneNumberStage = {
      stage: RegistrationStage.PHONE_NUMBER,
      phoneNumber:
        startingPhoneNumber || (blankPhoneNumber ? undefined : me?.get('e164')),
      profileData,
      status: waitUntil
        ? { type: 'waiting', readyAt: waitUntil }
        : { type: 'ready' },
    };

    dispatch(updateWorkflow(workflow));
  };
}

export function cancelRegistration(): CancelWorkflowActionType {
  const logId = `cancelRegistration`;
  log.info(logId);

  return {
    type: CANCEL_WORKFLOW,
  };
}

export function moveToCaptchaStage({
  phoneNumber,
  waitNeeded,
  workflow: previousWorkflow,
}: {
  phoneNumber: string;
  waitNeeded?: number;
  workflow: PhoneNumberStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async dispatch => {
    const logId = `moveToCaptchaStage(waitNeeded=${waitNeeded}, profileData=${Boolean(previousWorkflow.profileData)})`;
    log.info(logId);

    let workflow: PhoneNumberStage = previousWorkflow;

    const { profileData } = workflow;
    workflow = {
      ...workflow,
      status: {
        type: 'in-progress',
      },
    };
    dispatch(updateWorkflow(workflow));

    let result;
    try {
      result = await createVerificationSession(phoneNumber);
    } catch (error) {
      log.error(`${logId}: error`, toLogFormat(error));

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));

      return;
    }

    const nextWorkflow: CaptchaStage = {
      stage: RegistrationStage.CAPTCHA,
      verificationSessionId: result.sessionId,
      status: isNumber(waitNeeded)
        ? { type: 'waiting', canDoCaptchaAt: Date.now() + waitNeeded }
        : { type: 'ready' },
      captchaCompleteCount: 0,
      phoneNumber,
      profileData,
    };
    dispatch(updateWorkflow(nextWorkflow));
  };
}

export function moveToVerificationStage({
  workflow: previousWorkflow,
}: {
  workflow: CaptchaStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async (dispatch, getState) => {
    const logId = `moveToVerificationPage(profileData=${Boolean(previousWorkflow.profileData)})`;
    log.info(logId);

    const { verificationSessionId, phoneNumber } = previousWorkflow;

    let workflow: CaptchaStage = previousWorkflow;
    workflow = {
      ...workflow,
      status: {
        type: 'in-progress',
        startedAt: Date.now(),
      },
    };
    dispatch(updateWorkflow(workflow));

    openBrowserForCaptcha();

    // The user can open more browser windows and this await will still fire on completion
    const captchaToken = await challengeHandler.requestCaptcha({
      reason: 'standalone registration',
    });

    try {
      workflow = {
        ...workflow,
        captchaCompleteCount: previousWorkflow.captchaCompleteCount + 1,
      };
      dispatch(updateWorkflow(workflow));

      await submitCaptchaForVerificationSession({
        captchaToken,
        verificationSessionId,
        phoneNumber,
      });
    } catch (error) {
      log.error(`${logId}: error`, toLogFormat(error));

      if (
        error instanceof LibSignalErrorBase &&
        error.is(ErrorCode.RateLimitedError)
      ) {
        const canDoCaptchaAt = Date.now() + error.retryAfterSecs * SECOND;
        workflow = {
          ...workflow,
          status: {
            type: 'waiting',
            canDoCaptchaAt,
          },
        };
        dispatch(updateWorkflow(workflow));

        return;
      }

      if (error instanceof SessionNotAllowedToRequestCodeError) {
        workflow = {
          ...workflow,
          status: {
            type: 'another-needed',
          },
        };
        dispatch(updateWorkflow(workflow));

        return;
      }

      if (
        error instanceof LibSignalErrorBase &&
        (error.is(ErrorCode.RegistrationRequestRejected) ||
          error.is(ErrorCode.RegistrationRequestRejected))
      ) {
        workflow = {
          ...workflow,
          status: {
            type: 'failed',
          },
        };
        dispatch(updateWorkflow(workflow));

        return;
      }

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));

      return;
    }

    const nextWorkflow: VerificationCodeStage = {
      ...previousWorkflow,
      stage: RegistrationStage.VERIFICATION_CODE,
      codeSendCount: 0,
      failedSubmitCodeCount: 0,
      status: {
        type: 'ready',
      },
      failedToCall: false,
      failedToSendSMS: false,
    };
    drop(
      requestVerificationCode({
        transport: VerificationTransport.SMS,
        workflow: nextWorkflow,
      })(dispatch, getState, undefined)
    );
  };
}

export function openBrowserForCaptcha(): NoopActionType {
  const logId = `openBrowserForCaptcha`;
  log.info(logId);

  const url = getChallengeURL('registration');
  if (window.SignalCI) {
    log.warn(`${logId}: Not opening browser; running under CI`);
    return {
      type: `NOOP/${logId}`,
      payload: null,
    };
  }

  document.location.href = url;
  return {
    type: `NOOP/${logId}`,
    payload: null,
  };
}

export function requestVerificationCode({
  transport,
  workflow: previousWorkflow,
}: {
  transport: VerificationTransport;
  workflow: VerificationCodeStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async dispatch => {
    let workflow: VerificationCodeStage = previousWorkflow;
    const {
      codeSendCount,
      failedSubmitCodeCount,
      phoneNumber,
      verificationSessionId,
    } = workflow;
    const logId =
      `requestVerificationCode(codeSendCount=${codeSendCount}, ` +
      `failedSubmitCodeCount=${failedSubmitCodeCount}, ` +
      `profileData=${Boolean(previousWorkflow.profileData)})`;
    log.info(logId);

    if (
      (transport === VerificationTransport.SMS && workflow.failedToSendSMS) ||
      (transport === VerificationTransport.Voice && workflow.failedToCall)
    ) {
      log.error(
        `${logId}: Attempted to use transport ${transport}, but previously failed to use that transport`
      );
      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, FatalErrorType.UNEXPECTED));

      return;
    }

    let rawTimings: RawTimings | undefined;

    try {
      workflow = {
        ...workflow,
        status: {
          type: 'requesting-code',
          transport,
        },
      };
      dispatch(updateWorkflow(workflow));

      rawTimings = await requestCodeForVerificationSession({
        phoneNumber,
        verificationSessionId,
        transport,
        languages: window.SignalContext.getPreferredSystemLocales(),
      });
    } catch (error) {
      log.error(`${logId}: error`, toLogFormat(error));

      if (error instanceof LibSignalErrorBase) {
        if (error.is(ErrorCode.RegistrationVerificationSendFailed)) {
          if (
            (transport === VerificationTransport.SMS &&
              workflow.failedToCall) ||
            (transport === VerificationTransport.Voice &&
              workflow.failedToSendSMS)
          ) {
            log.error(
              `${logId}: Failed to use transport ${transport}, but previously failed to use other transport!`
            );
            workflow = {
              ...workflow,
              failedToCall: true,
              failedToSendSMS: true,
              status: {
                type: 'failed',
                error: 'cannot-send-code-permanent',
              },
              timings: error.sessionState
                ? extractTimings(error.sessionState)
                : undefined,
            };
            dispatch(updateWorkflow(workflow));
            return;
          }

          if (transport === VerificationTransport.SMS) {
            workflow = {
              ...workflow,
              failedToSendSMS: true,
              status: {
                type: 'ready',
              },
              timings: error.sessionState
                ? extractTimings(error.sessionState)
                : undefined,
            };
            dispatch(updateWorkflow(workflow));
            return;
          }

          if (transport === VerificationTransport.Voice) {
            workflow = {
              ...workflow,
              failedToCall: true,
              status: {
                type: 'ready',
              },
              timings: error.sessionState
                ? extractTimings(error.sessionState)
                : undefined,
            };
            dispatch(updateWorkflow(workflow));
            return;
          }

          throw missingCaseError(transport);
        } else if (
          error.is(ErrorCode.RegistrationVerificationCodeNotDeliverable)
        ) {
          if (error.permanentFailure) {
            workflow = {
              ...workflow,
              failedToCall: true,
              status: {
                type: 'failed',
                error: 'cannot-send-code-permanent',
              },
              timings: error.sessionState
                ? extractTimings(error.sessionState)
                : undefined,
            };
            dispatch(updateWorkflow(workflow));
            return;
          }

          workflow = {
            ...workflow,
            failedToCall: true,
            status: {
              type: 'failed',
              error: 'cannot-send-code-temporary',
            },
            timings: error.sessionState
              ? extractTimings(error.sessionState)
              : undefined,
          };
          dispatch(updateWorkflow(workflow));
          return;
        }
      }

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));
      return;
    }

    const timings = extractTimings(rawTimings);

    const nextWorkflow: VerificationCodeStage = {
      ...previousWorkflow,
      stage: RegistrationStage.VERIFICATION_CODE,
      codeSendCount: codeSendCount + 1,
      timings,
      failedSubmitCodeCount: 0,
    };
    dispatch(updateWorkflow(nextWorkflow));
  };
}

export function submitVerificationCode({
  code,
  workflow: previousWorkflow,
}: {
  code: string;
  workflow: VerificationCodeStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async dispatch => {
    const { codeSendCount, failedSubmitCodeCount } = previousWorkflow;
    const logId =
      `submitVerificationCode(codeSendCount=${codeSendCount}, ` +
      `failedSubmitCodeCount=${failedSubmitCodeCount}, ` +
      `profileData=${Boolean(previousWorkflow.profileData)})`;
    log.info(logId);

    let workflow = previousWorkflow;
    const { verificationSessionId, phoneNumber, profileData } = workflow;

    try {
      workflow = {
        ...workflow,
        status: {
          type: 'submitting-code',
        },
      };
      dispatch(updateWorkflow(workflow));

      await submitCodeForVerificationSession({
        phoneNumber,
        verificationSessionId,
        code,
      });
    } catch (error) {
      log.error(`${logId}: error submitting code`, toLogFormat(error));

      if (error instanceof SessionNotVerifiedError) {
        workflow = {
          ...workflow,
          failedSubmitCodeCount: workflow.failedSubmitCodeCount + 1,
          status: {
            type: 'failed',
            error: 'incorrect-code',
          },
        };
        dispatch(updateWorkflow(workflow));
        return;
      }

      if (error instanceof LibSignalErrorBase) {
        if (
          error.is(ErrorCode.RegistrationRequestInvalid) ||
          error.is(ErrorCode.RegistrationRequestRejected) ||
          error.is(ErrorCode.RegistrationSessionIdInvalid) ||
          error.is(ErrorCode.RegistrationSessionNotReadyForVerification)
        ) {
          workflow = {
            ...workflow,
            failedSubmitCodeCount: workflow.failedSubmitCodeCount + 1,
            status: {
              type: 'failed',
              error: 'invalid-code',
            },
          };
          dispatch(updateWorkflow(workflow));
          return;
        }
      }

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));
      return;
    }

    let accountState: LateStageAccountState | undefined;

    try {
      disableStorageService(
        'standaloneInstaller/submitVerificationCode, about to create account'
      );
      const result = await accountManager.registerAsPrimaryDevice({
        number: phoneNumber,
        sessionId: verificationSessionId,
        phoneNumberDiscoverability:
          profileData?.phoneNumberDiscoverability ??
          PhoneNumberDiscoverability.NotDiscoverable,
      });

      accountState = {
        created: true,
        hasPin: result.storageCapable,
      };

      if (accountState.hasPin) {
        await itemStorage.put(
          'standaloneRegistrationPartialState',
          PartialRegistrationType.EXISTING__PROFILE
        );
      } else {
        // We own storage service; no prior data there. We just turn it on!
        enableStorageService();
        await itemStorage.put(
          'standaloneRegistrationPartialState',
          PartialRegistrationType.NEW_ACCOUNT__PROFILE
        );
      }
    } catch (error) {
      log.error(`${logId}: error creating account`, toLogFormat(error));

      if (
        error instanceof LibSignalErrorBase &&
        error.is(ErrorCode.RegistrationLock)
      ) {
        if (!error.svr2Username || !error.svr2Password) {
          log.error(
            `${logId}: SVR credentials not returned with 423; cannot proceed`
          );
          const newWorkflow: AccountLockedStage = {
            stage: RegistrationStage.ACCOUNT_LOCKED,
          };
          dispatch(updateWorkflow(newWorkflow));
          return;
        }

        accountState = {
          created: false,
          phoneNumber,
          verificationSessionId,
          svrCredentials: {
            username: error.svr2Username,
            password: error.svr2Password,
          },
          avatars: undefined,
        };
      }

      if (!accountState) {
        workflow = {
          ...workflow,
          status: {
            type: 'ready',
          },
        };
        dispatch(updateWorkflow(workflow, analyzeError(error)));
        return;
      }
    }

    const newWorkflow: ProfileEntryStage = {
      stage: RegistrationStage.PROFILE_ENTRY,
      profileData: workflow.profileData,
      accountState,
      status: {
        type: 'ready',
      },
    };
    dispatch(updateWorkflow(newWorkflow));
  };
}

function goToProfileEntryStage(
  hasPin: boolean,
  profileData: ProfileData | undefined
): UpdateWorkflowActionType {
  const logId = 'goToProfileEntryStage';
  log.info(logId);

  const workflow: ProfileEntryStage = {
    stage: RegistrationStage.PROFILE_ENTRY,
    status: {
      type: 'ready',
    },
    accountState: {
      created: true,
      hasPin,
    },
    profileData,
  };
  return updateWorkflow(workflow);
}

export function finishProfileEntryStage({
  profileData,
  workflow: previousWorkflow,
}: {
  profileData: ProfileData;
  workflow: ProfileEntryStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async dispatch => {
    const logId = `finishProfileEntry(accountCreated=${previousWorkflow.accountState.created})`;
    log.info(logId);

    let workflow = previousWorkflow;
    const { accountState } = workflow;

    if (!accountState.created) {
      const nextWorkflow: VerifyPINStage = {
        stage: RegistrationStage.VERIFY_PIN,
        dataForReglockAccountCreate: {
          ...accountState,
          profileData,
        },
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(nextWorkflow));
      return;
    }

    try {
      workflow = {
        ...workflow,
        status: {
          type: 'in-progress',
        },
      };
      dispatch(updateWorkflow(workflow));

      await itemStorage.put(
        'phoneNumberDiscoverability',
        profileData.phoneNumberDiscoverability
      );
      await registrationJobQueue.add({
        type: 'UploadProfile',
        id: generateUuid(),
        reason: logId,
        firstName: profileData.firstName,
        familyName: profileData.lastName,
        avatarDataBase64: profileData.avatarData
          ? toBase64(profileData.avatarData)
          : undefined,
      });
    } catch (error) {
      log.error(
        `${logId}: error creating job to upload profile`,
        toLogFormat(error)
      );

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));
      return;
    }

    if (accountState.hasPin) {
      await itemStorage.put(
        'standaloneRegistrationPartialState',
        PartialRegistrationType.EXISTING__PIN
      );
      const nextWorkflow: VerifyPINStage = {
        stage: RegistrationStage.VERIFY_PIN,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(nextWorkflow));
      return;
    }

    await itemStorage.put(
      'standaloneRegistrationPartialState',
      PartialRegistrationType.NEW_ACCOUNT__PIN
    );
    const nextWorkflow: CreatePINStage = {
      stage: RegistrationStage.CREATE_PIN,
    };
    dispatch(updateWorkflow(nextWorkflow));
    return;
  };
}

function goToVerifyPINStage(): UpdateWorkflowActionType {
  const logId = 'goToVerifyPINStage';
  log.info(logId);

  const workflow: VerifyPINStage = {
    stage: RegistrationStage.VERIFY_PIN,
    status: {
      type: 'ready',
    },
  };
  return updateWorkflow(workflow);
}

export function verifyPIN({
  pin,
  workflow: previousWorkflow,
}: {
  pin: string;
  workflow: VerifyPINStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async (dispatch, getState) => {
    const { dataForReglockAccountCreate } = previousWorkflow;
    const logId = `verifyPIN(reglock=${Boolean(dataForReglockAccountCreate)})`;
    log.info(logId);

    let workflow = previousWorkflow;
    let result: RestoreResponseType;

    try {
      workflow = {
        ...workflow,
        status: {
          type: 'in-progress',
        },
      };
      dispatch(updateWorkflow(workflow));

      const getAuth = dataForReglockAccountCreate
        ? async () => dataForReglockAccountCreate.svrCredentials
        : undefined;

      result = await restoreFromSVR2(
        {
          pin: normalizePin(pin),
        },
        getAuth
      );

      if (!result.success) {
        const { error } = result;

        if (error === 'pin-incorrect') {
          const { triesRemaining } = result;
          log.info(
            `${logId}: PIN was incorrect; tries remaining: ${triesRemaining}`
          );

          workflow = {
            ...workflow,
            status: {
              type: 'failed',
              error: 'incorrect-pin',
            },
            triesRemaining,
          };
          dispatch(updateWorkflow(workflow));
        } else if (error === 'missing') {
          log.error(`${logId}: Nothing in SVR for this user!`);

          if (dataForReglockAccountCreate) {
            // Something has really gone wrong - we're in reglock, but SVR has nothing for us
            dispatch(updateWorkflow(workflow, FatalErrorType.UNEXPECTED));
          } else {
            // No reglock and nothing in SVR - let's allow the user to create a new PIN
            enableStorageService();
            await itemStorage.put(
              'standaloneRegistrationPartialState',
              PartialRegistrationType.NEW_ACCOUNT__PIN
            );
            dispatch(goToCreatePINStage());
          }
        } else {
          const unknownError: never = error;
          log.error(
            `${logId}: got unexpected error ${unknownError} from restoreFromSVR2!`
          );

          dispatch(updateWorkflow(workflow, FatalErrorType.UNEXPECTED));
        }

        return;
      }
    } catch (error) {
      log.error(`${logId}: error restoring from SVR2`, toLogFormat(error));

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };
      dispatch(updateWorkflow(workflow, analyzeError(error)));
      return;
    }

    const { data: masterKey } = result;

    if (!dataForReglockAccountCreate) {
      try {
        await itemStorage.put('svrPin', pin);
        await itemStorage.put(
          'temporaryRegistrationMasterKey',
          toBase64(masterKey)
        );
        await itemStorage.put('standaloneRegistrationPartialState', undefined);
        enableStorageService();
      } catch (error) {
        log.error(
          `${logId}: error saving data after creating account`,
          toLogFormat(error)
        );

        // Because account is already created, we can let the user try again
        workflow = {
          ...workflow,
          status: {
            type: 'ready',
          },
        };
        dispatch(updateWorkflow(workflow));
        return;
      }

      try {
        await registrationJobQueue.add({
          type: 'UpdateToNewMasterKey',
          id: generateUuid(),
          reason: logId,
          reglock: false,
        });
      } catch (error) {
        log.error(
          `${logId}: Error creating job to update to new masterKey`,
          toLogFormat(error)
        );

        // Because account is already created, we can let the user try again
        workflow = {
          ...workflow,
          status: {
            type: 'ready',
          },
        };
        dispatch(updateWorkflow(workflow));
        return;
      }

      await completeRegistration({ workflow })(dispatch, getState, undefined);
      return;
    }

    const { phoneNumber, verificationSessionId, profileData, avatars } =
      dataForReglockAccountCreate;

    const svrKey = new SvrKey(masterKey);
    const registrationLockData = svrKey.deriveRegistrationLock();
    const registrationLockToken = toHex(registrationLockData);

    try {
      disableStorageService(
        'standaloneInstaller/verifyPIN, about to create account'
      );
      await accountManager.registerAsPrimaryDevice({
        number: phoneNumber,
        sessionId: verificationSessionId,
        registrationLockToken,
        phoneNumberDiscoverability: profileData.phoneNumberDiscoverability,
      });
    } catch (error) {
      log.error(
        `${logId}: error creating account with reglock`,
        toLogFormat(error)
      );

      dispatch({
        type: UPDATE_WORKFLOW,
        payload: {
          workflow,
          fatalError: analyzeError(error),
        },
      });
      return;
    }

    try {
      await itemStorage.put('svrPin', pin);
      await itemStorage.put(
        'temporaryRegistrationMasterKey',
        toBase64(masterKey)
      );
      await itemStorage.put('standaloneRegistrationPartialState', undefined);
      await itemStorage.put(
        'phoneNumberDiscoverability',
        profileData.phoneNumberDiscoverability
      );

      const ourConversation =
        window.ConversationController.getOurConversationOrThrow();
      const existingAvatars = ourConversation.get('avatars');
      if (!existingAvatars?.length) {
        ourConversation.set({ avatars });
        await DataWriter.updateConversation(ourConversation.attributes);
      }

      enableStorageService();
    } catch (error) {
      log.error(
        `${logId}: error saving data after creating account`,
        toLogFormat(error)
      );
      dispatch({
        type: UPDATE_WORKFLOW,
        payload: {
          workflow,
          fatalError: FatalErrorType.UNEXPECTED,
        },
      });
    }

    try {
      await registrationJobQueue.add({
        type: 'UpdateToNewMasterKey',
        id: generateUuid(),
        reason: logId,
        reglock: true,
      });

      await registrationJobQueue.add({
        type: 'UploadProfile',
        id: generateUuid(),
        reason: logId,
        firstName: profileData.firstName,
        familyName: profileData.lastName,
        avatarDataBase64: profileData.avatarData
          ? toBase64(profileData.avatarData)
          : undefined,
      });
    } catch (error) {
      log.error(
        `${logId}: error queueing important jobs after creating account`,
        toLogFormat(error)
      );
      dispatch({
        type: UPDATE_WORKFLOW,
        payload: {
          workflow,
          fatalError: FatalErrorType.UNEXPECTED,
        },
      });
    }

    await completeRegistration({ workflow: previousWorkflow })(
      dispatch,
      getState,
      undefined
    );
  };
}

export function goToCreatePINStage(): UpdateWorkflowActionType {
  const logId = 'goToCreatePINStage';
  log.info(logId);

  const workflow: CreatePINStage = {
    stage: RegistrationStage.CREATE_PIN,
  };
  return updateWorkflow(workflow);
}

export function startConfirmingPIN({
  pin,
  workflow,
}: {
  pin: string;
  workflow: CreatePINStage;
}): UpdateWorkflowActionType {
  const logId = `startConfirmingPIN(pinLength=${pin.length})`;
  log.info(logId);

  const nextWorkflow: CreatePINConfirmStage = {
    ...workflow,
    stage: RegistrationStage.CREATE_PIN_CONFIRM,
    status: {
      type: 'ready',
    },
    pin,
  };
  return updateWorkflow(nextWorkflow);
}

export function createPIN({
  pin,
  workflow: previousWorkflow,
}: {
  pin: string;
  workflow: CreatePINConfirmStage;
}): ThunkAction<Promise<void>, StateType, unknown, UpdateWorkflowActionType> {
  return async (dispatch, getState) => {
    const logId = `createPIN(pinLength=${pin.length})`;
    log.info(logId);

    let workflow = previousWorkflow;

    const { masterKey } = getState().items;
    if (!masterKey) {
      log.error(`${logId}: masterKey not present in items!`);
      dispatch(updateWorkflow(workflow, FatalErrorType.UNEXPECTED));
      return;
    }

    try {
      workflow = {
        ...workflow,
        status: {
          type: 'in-progress',
        },
      };
      dispatch(updateWorkflow(workflow));

      await itemStorage.put('svrPin', pin);
      await itemStorage.put('standaloneRegistrationPartialState', undefined);

      await registrationJobQueue.add({
        type: 'StoreSVR',
        id: generateUuid(),
        reason: logId,
      });
    } catch (error) {
      log.error(`${logId}: error storing to SVR2`, toLogFormat(error));

      workflow = {
        ...workflow,
        status: {
          type: 'ready',
        },
      };

      dispatch(updateWorkflow(workflow, analyzeError(error)));
      return;
    }

    await completeRegistration({ workflow })(dispatch, getState, undefined);
  };
}

export function goToAccountLockedStage(): UpdateWorkflowActionType {
  const logId = 'goToAccountLockedStage';
  log.info(logId);

  const workflow: AccountLockedStage = {
    stage: RegistrationStage.ACCOUNT_LOCKED,
  };
  return updateWorkflow(workflow);
}

export function completeRegistration({
  workflow: previousWorkflow,
}: {
  workflow: VerifyPINStage | CreatePINStage | CreatePINConfirmStage;
}): ThunkAction<
  Promise<void>,
  StateType,
  unknown,
  OpenInboxActionType | UpdateWorkflowActionType
> {
  return async (dispatch, getState) => {
    const logId = `completeRegistration`;
    log.info(logId);

    assertDev(
      ValidStepsBeforeComplete.has(previousWorkflow.stage),
      `${logId}: Stage ${previousWorkflow.stage} is not a valid 'before complete' stage`
    );

    window.IPC.removeSetupMenuItems();

    await openInbox()(dispatch, getState, undefined);

    dispatch({
      type: UPDATE_WORKFLOW,
      payload: {
        workflow: undefined,
      },
    });
  };
}

// These three functions are needed to keep avatars created during the registration
// process around until we have a conversation to add them to. Currently only needed when
// the account has reglock - we can only create the account late in the process.

function deleteAvatarFromDisk(
  avatarData: AvatarDataType
): ThunkAction<
  Promise<void>,
  StateType,
  unknown,
  OpenInboxActionType | UpdateWorkflowActionType
> {
  return async (dispatch, getState) => {
    const logId = 'deleteAvatarFromDisk';
    const state = getState();
    const { workflow } = state.standaloneInstaller;

    if (workflow?.stage !== RegistrationStage.PROFILE_ENTRY) {
      throw new Error(`${logId}: Unexpected workflow ${workflow?.stage}`);
    }

    if (workflow.accountState.created) {
      throw new Error(
        `${logId}: Already created account, shouldn't need to store avatars this way`
      );
    }

    if (avatarData.imagePath) {
      await deleteAvatar(avatarData.imagePath);
    } else {
      log.info(
        'No path for avatarData. Removing from userAvatarData, but not disk'
      );
    }

    const { avatars } = workflow.accountState;
    const updatedWorkflow = {
      ...workflow,
      accountState: {
        ...workflow.accountState,
        avatars: filterAvatarData(avatars ?? [], avatarData),
      },
    };

    dispatch({
      type: UPDATE_WORKFLOW,
      payload: {
        workflow: updatedWorkflow,
      },
    });
  };
}
function replaceAvatar(
  curr: AvatarDataType,
  prev?: AvatarDataType
): ThunkAction<
  void,
  StateType,
  unknown,
  OpenInboxActionType | UpdateWorkflowActionType
> {
  return (dispatch, getState) => {
    const logId = 'replaceAvatar';
    const state = getState();
    const { workflow } = state.standaloneInstaller;

    if (workflow?.stage !== RegistrationStage.PROFILE_ENTRY) {
      throw new Error(`${logId}: Unexpected workflow ${workflow?.stage}`);
    }

    if (workflow.accountState.created) {
      throw new Error(
        `${logId}: Already created account, shouldn't need to store avatars this way`
      );
    }

    const { avatars } = workflow.accountState;
    const nextAvatarId = getNextAvatarId(avatars ?? []);
    const newAvatarData = {
      ...curr,
      id: prev?.id ?? nextAvatarId,
    };
    const existingAvatarsData = prev
      ? filterAvatarData(avatars ?? [], prev)
      : (avatars ?? []);

    const updatedWorkflow = {
      ...workflow,
      accountState: {
        ...workflow.accountState,
        avatars: [newAvatarData, ...existingAvatarsData],
      },
    };

    dispatch({
      type: UPDATE_WORKFLOW,
      payload: {
        workflow: updatedWorkflow,
      },
    });
  };
}
function saveAvatarToDisk(
  avatarData: AvatarDataType
): ThunkAction<
  Promise<void>,
  StateType,
  unknown,
  OpenInboxActionType | UpdateWorkflowActionType
> {
  return async (dispatch, getState) => {
    const logId = 'saveAvatarToDisk';
    const state = getState();
    const { workflow } = state.standaloneInstaller;

    if (!avatarData.buffer) {
      throw new Error('saveAvatarToDisk: No avatar Uint8Array provided');
    }

    if (workflow?.stage !== RegistrationStage.PROFILE_ENTRY) {
      throw new Error(`${logId}: Unexpected workflow ${workflow?.stage}`);
    }

    if (workflow.accountState.created) {
      throw new Error(
        `${logId}: Already created account, shouldn't need to store avatars this way`
      );
    }

    const { path: imagePath, ...localImage } = await writeNewAvatarData(
      avatarData.buffer
    );

    const { avatars } = workflow.accountState;
    const nextAvatarId = getNextAvatarId(avatars ?? []);

    const newAvatarData = {
      ...avatarData,
      ...localImage,
      imagePath,
      id: nextAvatarId,
    };

    const updatedWorkflow = {
      ...workflow,
      accountState: {
        ...workflow.accountState,
        avatars: [newAvatarData, ...(avatars ?? [])],
      },
    };

    dispatch({
      type: UPDATE_WORKFLOW,
      payload: {
        workflow: updatedWorkflow,
      },
    });
  };
}

export const actions = {
  cancelRegistration,
  completeRegistration,
  createPIN,
  finishProfileEntryStage,
  goToAccountLockedStage,
  goToCreatePINStage,
  goToProfileEntryStage,
  goToVerifyPINStage,
  moveToCaptchaStage,
  moveToVerificationStage,
  openBrowserForCaptcha,
  requestVerificationCode,
  startConfirmingPIN,
  startRegistration,
  submitVerificationCode,
  verifyPIN,
  // For AvatarEditor support
  deleteAvatarFromDisk,
  replaceAvatar,
  saveAvatarToDisk,
};

export const useStandaloneInstallerActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Utilities

function analyzeError(error: Error): FatalErrorType {
  // TODO: might want to do something here for rate limit errors
  if (error instanceof LibSignalErrorBase) {
    if (
      error.is(ErrorCode.ChatServiceInactive) ||
      error.is(ErrorCode.IoError) ||
      error.is(ErrorCode.PossibleCaptiveNetwork)
    ) {
      return FatalErrorType.OFFLINE;
    }
    if (error.is(ErrorCode.AppExpired)) {
      return FatalErrorType.UPDATE_REQUIRED;
    }
  }

  return FatalErrorType.UNEXPECTED;
}

function extractTimings(rawTimings: RawTimings): Timings {
  return {
    smsCanBeRequestedAt: secondsToTimestamp(rawTimings.nextSmsSecs),
    callCanBeRequestedAt: secondsToTimestamp(rawTimings.nextCallSecs),
    codeCanBeSubmittedAt: secondsToTimestamp(
      rawTimings.nextVerificationAttemptSecs
    ),
  };
}

function secondsToTimestamp(seconds: number | undefined) {
  if (!isNumber(seconds)) {
    return undefined;
  }
  return Date.now() + seconds * SECOND;
}

// Reducer

export type StandaloneInstallerStateType = ReadonlyDeep<{
  workflow: RegistrationWorkflow | undefined;
  fatalError: FatalErrorType | undefined;
  direction: Direction;
}>;

export function getEmptyState(): StandaloneInstallerStateType {
  return {
    workflow: undefined,
    fatalError: undefined,
    direction: Direction.FORWARD,
  };
}

export function reducer(
  state: Readonly<StandaloneInstallerStateType> = getEmptyState(),
  action: Readonly<StandaloneInstallerActionType>
): StandaloneInstallerStateType {
  if (action.type === UPDATE_WORKFLOW) {
    const previousWorkflow = state.workflow;
    const { workflow: newWorkflow, fatalError } = action.payload;

    if (!newWorkflow) {
      log.info(
        `UPDATE_WORKFLOW: Clearing workflow. Previous stage was ${previousWorkflow?.stage ?? '<none>'}`
      );
      return getEmptyState();
    }

    if (newWorkflow.stage === RegistrationStage.PHONE_NUMBER) {
      log.info(
        `UPDATE_WORKFLOW: Transitioning from ${previousWorkflow?.stage ?? '<none>'} to ${newWorkflow.stage}`
      );
      return {
        ...state,
        workflow: newWorkflow,
        fatalError,
        direction:
          previousWorkflow &&
          previousWorkflow.stage !== RegistrationStage.PHONE_NUMBER
            ? Direction.BACKWARD
            : Direction.FORWARD,
      };
    }

    if (!previousWorkflow) {
      // The user can restart the registration process after shutdown/crash at these stages
      // See PartialRegistrationType.
      if (
        newWorkflow.stage === RegistrationStage.PROFILE_ENTRY ||
        newWorkflow.stage === RegistrationStage.VERIFY_PIN ||
        newWorkflow.stage === RegistrationStage.CREATE_PIN
      ) {
        log.info(`UPDATE_WORKFLOW: Starting from ${newWorkflow.stage}`);
        return {
          ...state,
          workflow: newWorkflow,
          fatalError,
          direction: Direction.FORWARD,
        };
      }

      log.error(
        `UPDATE_WORKFLOW: Invalid transition; attempting start with ${newWorkflow.stage}`
      );
      return {
        ...state,
        fatalError: FatalErrorType.UNEXPECTED,
      };
    }

    if (previousWorkflow.stage === newWorkflow.stage) {
      return {
        ...state,
        workflow: newWorkflow,
        fatalError,
        direction: Direction.FORWARD,
      };
    }

    const validNextStages = ValidNextStages[previousWorkflow.stage];
    if (!validNextStages.has(newWorkflow.stage)) {
      log.error(
        `UPDATE_WORKFLOW: Invalid transition; attempting to go from ${previousWorkflow.stage} to ${newWorkflow.stage}`
      );
      return {
        ...state,
        fatalError: FatalErrorType.UNEXPECTED,
      };
    }

    log.info(
      `UPDATE_WORKFLOW: Transitioning from ${previousWorkflow.stage} to ${newWorkflow.stage}`
    );

    const previousOrder = StageOrder[previousWorkflow.stage];
    const currentOrder = StageOrder[previousWorkflow.stage];

    return {
      ...state,
      workflow: newWorkflow,
      fatalError,
      direction:
        currentOrder >= previousOrder ? Direction.FORWARD : Direction.BACKWARD,
    };
  }

  if (action.type === CANCEL_WORKFLOW) {
    return getEmptyState();
  }

  return state;
}
