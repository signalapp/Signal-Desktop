// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { orderBy } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log.std.ts';
import {
  LinkDeviceWorkflowStage,
  ValidNextStages,
  ValidStepsBeforeComplete,
} from '../../types/LinkedDevices.std.ts';
import {
  getDevices,
  getProvisioningCode,
  sendProvisioningMessage,
  sendTransferArchive,
  unlink,
  updateDeviceName,
  waitForLinkedDevice,
} from '../../textsecure/WebAPI.preload.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { isInPast } from '../../util/timestamp.std.ts';
import { MINUTE, SECOND } from '../../util/durations/constants.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { toBase64 } from '../../Bytes.std.ts';
import {
  decryptDevice,
  decryptServerDevice,
  encryptDeviceName,
} from '../../util/decryptDevice.preload.ts';
import { findRetryAfterTimeFromError } from '../../jobs/helpers/findRetryAfterTimeFromError.std.ts';
import { sleep } from '../../util/sleep.std.ts';
import { assembleProvisioningEnvelope } from '../../util/assembleProvisioningEnvelope.preload.ts';
import { assertDev, strictAssert } from '../../util/assert.std.ts';
import { promptOSAuth } from '../../util/promptOSAuth.sandbox.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { PublicKey } from '@signalapp/libsignal-client';
import { ToastType } from '../../types/Toast.std.ts';
import { showToast, type ShowToastActionType } from './toast.dom.ts';
import { getIntl } from '../selectors/user.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { drop } from '../../util/drop.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';

import type {
  ConfirmingWithOSStage,
  CandidateDeviceInfo,
  ChoosingTransferMessagesStage,
  LinkDeviceWorkflow,
  ScanningQRCodeStage,
  SendingProvisioningMessageStage,
  WaitingForLinkCompleteStage,
  ErrorStage,
  TransferringMessagesStage,
} from '../../types/LinkedDevices.std.ts';
import type { AsyncStateThunk } from '../types.std.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import type { LinkedDevice } from '../../sql/Interface.std.ts';

const log = createLogger('ducks/linkedDevices');

const {
  createOrUpdateLinkedDevice,
  replaceAllLinkedDevices,
  removeLinkedDeviceById,
} = DataWriter;

// Types

export type LinkedDevicesStateType = ReadonlyDeep<{
  workflow: LinkDeviceWorkflow | undefined;
  devices: ReadonlyArray<LinkedDevice> | undefined;
}>;

const ADD_DEVICE = 'linkedDevices/ADD_DEVICE';
const REFRESH_DEVICES = 'linkedDevices/REFRESH_DEVICES';
const REMOVE_DEVICE = 'linkedDevices/REMOVE_DEVICE';

const CANCEL_WORKFLOW = 'linkedDevices/CANCEL_WORKFLOW';
const UPDATE_WORKFLOW = 'linkedDevices/UPDATE_WORKFLOW';

type AddDeviceActionType = ReadonlyDeep<{
  type: typeof ADD_DEVICE;
  device: LinkedDevice;
}>;

type RefreshDevicesActionType = ReadonlyDeep<{
  type: typeof REFRESH_DEVICES;
  devices: ReadonlyArray<LinkedDevice>;
}>;

type RemoveDeviceActionType = ReadonlyDeep<{
  type: typeof REMOVE_DEVICE;
  deviceId: number;
}>;

type CancelWorkflowActionType = ReadonlyDeep<{
  type: typeof CANCEL_WORKFLOW;
}>;

type UpdateWorkflowActionType = ReadonlyDeep<{
  type: typeof UPDATE_WORKFLOW;
  payload: {
    workflow: LinkDeviceWorkflow | undefined;
  };
}>;

type LinkedDevicesActionType = ReadonlyDeep<
  | AddDeviceActionType
  | CancelWorkflowActionType
  | RefreshDevicesActionType
  | RemoveDeviceActionType
  | UpdateWorkflowActionType
>;

// Steps

function addDevice(device: LinkedDevice): AsyncStateThunk<AddDeviceActionType> {
  return async dispatch => {
    const logId = 'addDevice';
    log.info(logId);

    await createOrUpdateLinkedDevice(device);

    dispatch({
      type: ADD_DEVICE,
      device,
    });
  };
}

export function renameDevice(
  deviceId: number,
  name: string
): AsyncStateThunk<AddDeviceActionType | ShowToastActionType> {
  return async (dispatch, getState) => {
    const logId = `renameDevice/${deviceId}`;
    log.info(logId);

    const existingDevice = getState().linkedDevices.devices?.find(
      device => device.id === deviceId
    );
    if (!existingDevice) {
      throw new Error(`${logId}: Device ${deviceId} not found!`);
    }

    const ourAci = itemStorage.user.getCheckedAci();
    const identityKey = signalProtocolStore.getIdentityKeyPair(ourAci);
    if (!identityKey) {
      throw new Error('decryptDeviceName: No identity key pair!');
    }

    const encryptedName = encryptDeviceName(name, identityKey);
    strictAssert(
      encryptedName,
      `${logId}: Expect to get a result from encryption!`
    );

    try {
      await updateDeviceName({ deviceId, encryptedName });
      const device = {
        ...existingDevice,
        name,
      };
      await createOrUpdateLinkedDevice(device);

      dispatch(
        showToast({
          toastType: ToastType.LinkedDeviceNameUpdated,
        })
      );

      dispatch({
        type: ADD_DEVICE,
        device,
      });

      drop(
        singleProtoJobQueue.add(
          MessageSender.getDeviceNameChangeSyncMessage(deviceId)
        )
      );
    } catch (error) {
      log.error(`${logId}: Failed to update device name`, toLogFormat(error));
      // TODO: show toast that we failed to update the device name
    }
  };
}
export function removeDevice(
  deviceId: number,
  deviceName: string | null
): AsyncStateThunk<RemoveDeviceActionType | ShowToastActionType> {
  return async (dispatch, getState) => {
    const logId = `removeDevice/${deviceId}`;
    log.info(logId);

    const i18n = getIntl(getState());

    try {
      await unlink(deviceId);
      await removeLinkedDeviceById(deviceId);

      dispatch(
        showToast({
          toastType: ToastType.LinkedDeviceRemoved,
          parameters: {
            name:
              deviceName ||
              i18n('icu:Preferences--LinkedDevices--DeviceList--defaultName'),
          },
        })
      );

      dispatch({
        type: REMOVE_DEVICE,
        deviceId,
      });
    } catch (error) {
      log.error(`${logId}: Failed to remove device:`, toLogFormat(error));
      // TODO: show toast that we failed to remove device
    }
  };
}
export function refreshDevices(): AsyncStateThunk<RefreshDevicesActionType> {
  return async dispatch => {
    const logId = 'refreshDevices';
    log.info(logId);

    const encryptedDevices = await getDevices();
    try {
      const devices = await Promise.all(
        encryptedDevices.filter(device => device.id !== 1).map(decryptDevice)
      );
      await replaceAllLinkedDevices(devices);

      dispatch({
        type: REFRESH_DEVICES,
        devices,
      });
    } catch (error) {
      log.error(`${logId}: Failed to update devices:`, toLogFormat(error));
    }
  };
}

export function startLinking(): AsyncStateThunk<
  UpdateWorkflowActionType | CancelWorkflowActionType
> {
  return async dispatch => {
    const logId = 'startLinking';
    log.info(logId);

    const startingWorkflow: ConfirmingWithOSStage = {
      stage: LinkDeviceWorkflowStage.ConfirmingWithOS,
    };
    dispatch(updateWorkflow(startingWorkflow));

    const nextWorkflow: ScanningQRCodeStage = {
      stage: LinkDeviceWorkflowStage.ScanningQRCode,
    };
    const errorWorkflow: ErrorStage = {
      stage: LinkDeviceWorkflowStage.Error,
    };

    try {
      const result = await promptOSAuth('link-device');

      switch (result) {
        case 'success':
          dispatch(updateWorkflow(nextWorkflow));
          break;
        case 'unsupported':
          log.warn(`${logId}/promptOS: Unsupported, continuing on`);
          dispatch(updateWorkflow(nextWorkflow));
          break;
        case 'unauthorized':
          log.warn(`${logId}/promptOS: Not authorized; clearing workflow`);
          dispatch(updateWorkflow(errorWorkflow));
          break;
        case 'error':
          log.warn(`${logId}/promptOS: Error; clearing workflow`);
          dispatch(updateWorkflow(errorWorkflow));
          break;
        default:
          throw missingCaseError(result);
      }
    } catch (error) {
      log.error(`${logId}/promptOS: Error`, toLogFormat(error));
      dispatch(updateWorkflow(errorWorkflow));
    }
  };
}

// export function goToQRCodeScanning(): UpdateWorkflowActionType {
//   const workflow: ScanningQRCodeStage = {
//     stage: LinkDeviceWorkflowStage.ScanningQRCode,
//   };

//   return updateWorkflow(workflow);
// }

export function cancelLinking(): CancelWorkflowActionType {
  const logId = `cancelLinking`;
  log.info(logId);

  return {
    type: CANCEL_WORKFLOW,
  };
}

export function moveToChoosingTransferMessages({
  candidateDeviceInfo,
  workflow: previousWorkflow,
}: {
  candidateDeviceInfo: CandidateDeviceInfo;
  workflow: ScanningQRCodeStage;
}): AsyncStateThunk<UpdateWorkflowActionType> {
  return async dispatch => {
    const logId = `moveToChoosingTransferMessages(previousStage=${previousWorkflow.stage})`;
    log.info(logId);

    const workflow: ChoosingTransferMessagesStage = {
      stage: LinkDeviceWorkflowStage.ChoosingTransferMessages,
      candidateDeviceInfo,
    };
    dispatch(updateWorkflow(workflow));
  };
}

export function sendInfoForLink({
  willTransferMessages,
  candidateDeviceInfo,
  workflow: previousWorkflow,
}: {
  willTransferMessages: boolean;
  candidateDeviceInfo: CandidateDeviceInfo;
  workflow: ChoosingTransferMessagesStage | ScanningQRCodeStage;
}): AsyncStateThunk<UpdateWorkflowActionType> {
  return async (dispatch, getState) => {
    const logId = `sendProvisionMessage(willTransferMessages=${willTransferMessages}, previousWorkflow=${previousWorkflow.stage})`;
    log.info(logId);

    const abortController = new AbortController();
    const workflow: SendingProvisioningMessageStage = {
      stage: LinkDeviceWorkflowStage.SendingProvisioningMessage,
      willTransferMessages,
      abortController,
    };
    dispatch(updateWorkflow(workflow));

    try {
      const { address, publicKey } = candidateDeviceInfo;

      const { verificationCode, tokenIdentifier } = await getProvisioningCode(
        abortController.signal
      );
      if (abortController.signal.aborted) {
        log.info(`${logId}: User cancelled`);
        return;
      }

      const ephemeralBackupKey = willTransferMessages
        ? getRandomBytes(32)
        : undefined;

      const protoBytes = assembleProvisioningEnvelope({
        ephemeralBackupKey,
        theirPublicKey: PublicKey.deserialize(publicKey),
        verificationCode,
      });
      await sendProvisioningMessage({
        abortSignal: abortController.signal,
        address,
        protoInBase64: toBase64(protoBytes),
      });
      if (abortController.signal.aborted) {
        log.info(`${logId}: User cancelled`);
        return;
      }

      drop(
        waitForLinkComplete({
          ephemeralBackupKey,
          tokenIdentifier,
          workflow,
        })(dispatch, getState)
      );
    } catch (error) {
      log.error(`${logId}:`, toLogFormat(error));

      if (abortController.signal.aborted) {
        log.info(`${logId}: User cancelled`);
        return;
      }

      const errorWorkflow: ErrorStage = {
        stage: LinkDeviceWorkflowStage.Error,
      };
      dispatch(updateWorkflow(errorWorkflow));
    }
  };
}

function waitForLinkComplete({
  ephemeralBackupKey,
  tokenIdentifier,
  workflow: previousWorkflow,
}: {
  ephemeralBackupKey: Uint8Array<ArrayBuffer> | undefined;
  tokenIdentifier: string;
  workflow: SendingProvisioningMessageStage;
}): AsyncStateThunk<
  UpdateWorkflowActionType | AddDeviceActionType | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const logId = `waitForLinkComplete(hasBackupKey=${Boolean(ephemeralBackupKey)}, previousStage=${previousWorkflow.stage})`;
    log.info(logId);

    const i18n = getIntl(getState());

    const abortController = new AbortController();
    const workflow: WaitingForLinkCompleteStage = {
      stage: LinkDeviceWorkflowStage.WaitingForLinkComplete,
      transferMessagesData: ephemeralBackupKey
        ? { ephemeralBackupKey }
        : undefined,
      tokenIdentifier,
      abortController,
    };
    dispatch(updateWorkflow(workflow));

    const maxWaitTime = 5 * MINUTE;
    const expiresAt = Date.now() + maxWaitTime;

    // oxlint-disable-next-line no-constant-condition
    while (true) {
      const timeoutSeconds = Math.floor((expiresAt - Date.now()) / SECOND);
      if (timeoutSeconds < 1) {
        log.warn(
          `${logId}: Linked device took too long to finish process (timeout was ${timeoutSeconds})`
        );
        const errorWorkflow: ErrorStage = {
          stage: LinkDeviceWorkflowStage.Error,
        };
        dispatch(updateWorkflow(errorWorkflow));
        return;
      }

      try {
        // oxlint-disable-next-line no-await-in-loop
        const waitResult = await waitForLinkedDevice({
          abortSignal: abortController.signal,
          tokenIdentifier,
          timeoutSeconds,
        });
        if (abortController.signal.aborted) {
          log.info(`${logId}: User cancelled `);
          return;
        }

        if (waitResult.type === 'done') {
          const { device } = waitResult;

          // oxlint-disable-next-line no-await-in-loop
          const decryptedDevice = await decryptServerDevice(device);

          // oxlint-disable-next-line no-await-in-loop
          await addDevice(decryptedDevice)(dispatch, getState);

          if (ephemeralBackupKey) {
            // oxlint-disable-next-line no-await-in-loop
            await transferMessages({
              device: decryptedDevice,
              ephemeralBackupKey,
              workflow,
            })(dispatch, getState);
          } else {
            dispatch(
              showToast({
                toastType: ToastType.LinkedDeviceAdded,
                parameters: {
                  name:
                    decryptedDevice.name ||
                    i18n(
                      'icu:Preferences--LinkedDevices--DeviceList--defaultName'
                    ),
                },
              })
            );

            // oxlint-disable-next-line no-await-in-loop
            await finishLinking({ workflow })(dispatch, getState);
          }

          return;
        }

        if (isInPast(expiresAt)) {
          log.warn(
            `${logId}: Linked device took too long to finish process, timeout was at ${expiresAt}`
          );
          const errorWorkflow: ErrorStage = {
            stage: LinkDeviceWorkflowStage.Error,
          };
          dispatch(updateWorkflow(errorWorkflow));
          return;
        }

        if (waitResult.type === 'notDone') {
          continue;
        }

        throw missingCaseError(waitResult);
      } catch (error) {
        log.error(`${logId}:`, toLogFormat(error));

        if (abortController.signal.aborted) {
          log.info(`${logId}: User cancelled`);
          return;
        }

        if (error.code === 429) {
          const retryAfter = findRetryAfterTimeFromError(error);
          const restartAt = Date.now() + retryAfter;

          if (restartAt > expiresAt) {
            log.warn(
              `${logId}: Server retryAfter was ${retryAfter}ms, that would be too long for device to finish process`
            );
            const errorWorkflow: ErrorStage = {
              stage: LinkDeviceWorkflowStage.Error,
            };
            dispatch(updateWorkflow(errorWorkflow));
            return;
          }

          // oxlint-disable-next-line no-await-in-loop
          await sleep(retryAfter);
          continue;
        }

        const errorWorkflow: ErrorStage = {
          stage: LinkDeviceWorkflowStage.Error,
        };
        dispatch(updateWorkflow(errorWorkflow));
        return;
      }
    }
  };
}

function transferMessages({
  device,
  ephemeralBackupKey,
  workflow: previousWorkflow,
}: {
  device: LinkedDevice;
  ephemeralBackupKey: Uint8Array<ArrayBuffer>;
  workflow: WaitingForLinkCompleteStage;
}): AsyncStateThunk<UpdateWorkflowActionType | ShowToastActionType> {
  return async (dispatch, getState) => {
    const logId = `transferMessages(previousStage=${previousWorkflow.stage})`;
    log.info(logId);

    const abortController = new AbortController();
    const workflow: TransferringMessagesStage = {
      stage: LinkDeviceWorkflowStage.TransferringMessages,
      deviceId: device.id,
      deviceRegistrationId: device.registrationId,
      ephemeralBackupKey,
      progress: undefined,
      abortController,
    };
    dispatch(updateWorkflow(workflow));

    try {
      // TODO: Make backup, updating progress as we do it, honor abortSignal
      // TODO: Upload it, updating progress as we do it, honor abortSignal
      // const transferArchive = {
      //   cdn: 3,
      //   key: 'randomKey',
      // };

      // The errors we'll hydrate here:
      // 'not-enough-space' - check space before generating payload, not recoverable
      // 'failed-to-make-backup' - creation or validation error, not recoverable
      // 'failed-to-upload' - failure when uploading, recoverable

      // For now, we tell the linked device to continue without link'n'sync
      const transferArchive = {
        error: 'CONTINUE_WITHOUT_UPLOAD' as const,
      };

      await sendTransferArchive(
        {
          destinationDeviceId: device.id,
          destinationDeviceRegistrationId: device.registrationId,
          transferArchive,
        },
        abortController.signal
      );

      dispatch(
        showToast({
          toastType: ToastType.LinkedDeviceSyncComplete,
        })
      );

      await finishLinking({ workflow })(dispatch, getState);
    } catch (error) {
      log.error(`${logId}:`, toLogFormat(error));

      if (abortController.signal.aborted) {
        log.info(`${logId}: User cancelled`);
        return;
      }

      const errorWorkflow: ErrorStage = {
        stage: LinkDeviceWorkflowStage.Error,
      };
      dispatch(updateWorkflow(errorWorkflow));
    }
  };
}

function finishLinking({
  workflow: previousWorkflow,
}: {
  workflow: TransferringMessagesStage | WaitingForLinkCompleteStage;
}): AsyncStateThunk<UpdateWorkflowActionType> {
  return async dispatch => {
    const logId = `finishLinking(previousStage=${previousWorkflow.stage})`;
    log.info(logId);

    assertDev(
      ValidStepsBeforeComplete.has(previousWorkflow.stage),
      `${logId}: Stage ${previousWorkflow.stage} is not a valid 'before complete' stage`
    );

    dispatch(updateWorkflow(undefined));
  };
}

export const actions = {
  addDevice,
  cancelLinking,
  finishLinking,
  // goToQRCodeScanning,
  moveToChoosingTransferMessages,
  refreshDevices,
  removeDevice,
  renameDevice,
  sendInfoForLink,
  startLinking,
  transferMessages,
  waitForLinkComplete,
};

export const useLinkedDevicesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Helper functions

function updateWorkflow(
  workflow: LinkDeviceWorkflow | undefined
): UpdateWorkflowActionType {
  return {
    type: UPDATE_WORKFLOW,
    payload: { workflow },
  };
}

function sortDevices(
  devices: ReadonlyArray<LinkedDevice>
): ReadonlyArray<LinkedDevice> {
  return orderBy(devices, ['createdAt', 'lastSeenAt'], ['desc', 'desc']);
}

// Reducer

export function getEmptyState(): LinkedDevicesStateType {
  return {
    workflow: undefined,
    devices: undefined,
  };
}

export function reducer(
  state: Readonly<LinkedDevicesStateType> = getEmptyState(),
  action: Readonly<LinkedDevicesActionType>
): LinkedDevicesStateType {
  if (action.type === ADD_DEVICE) {
    const { device } = action;
    const existingDevices = state.devices?.filter(
      item => item.id !== device.id
    );

    return {
      ...state,
      devices: sortDevices([...(existingDevices || []), device]),
    };
  }

  if (action.type === REFRESH_DEVICES) {
    const { devices } = action;

    return {
      ...state,
      devices: sortDevices(devices),
    };
  }

  if (action.type === REMOVE_DEVICE) {
    const { deviceId } = action;
    const devices = state.devices?.filter(item => item.id !== deviceId);

    return {
      ...state,
      devices,
    };
  }

  if (action.type === UPDATE_WORKFLOW) {
    const previousWorkflow = state.workflow;
    const { workflow: newWorkflow } = action.payload;

    if (!newWorkflow) {
      log.info(
        `UPDATE_WORKFLOW: Clearing workflow. Previous stage was ${previousWorkflow?.stage ?? '<none>'}`
      );
      return {
        ...state,
        workflow: undefined,
      };
    }

    if (previousWorkflow?.stage === newWorkflow.stage) {
      return {
        ...state,
        workflow: newWorkflow,
      };
    }

    if (
      !previousWorkflow ||
      newWorkflow.stage === LinkDeviceWorkflowStage.ConfirmingWithOS ||
      newWorkflow.stage === LinkDeviceWorkflowStage.Error
    ) {
      log.info(
        `UPDATE_WORKFLOW: Transitioning from ${previousWorkflow?.stage ?? '<none>'} to ${newWorkflow.stage}`
      );

      return {
        ...state,
        workflow: newWorkflow,
      };
    }

    const validNextStages = ValidNextStages[previousWorkflow.stage];
    if (!validNextStages.has(newWorkflow.stage)) {
      log.error(
        `UPDATE_WORKFLOW: Invalid transition; attempting to go from ${previousWorkflow.stage} to ${newWorkflow.stage}`
      );
      return {
        ...state,
        workflow: {
          stage: LinkDeviceWorkflowStage.Error,
        },
      };
    }

    log.info(
      `UPDATE_WORKFLOW: Transitioning from ${previousWorkflow.stage} to ${newWorkflow.stage}`
    );

    return {
      ...state,
      workflow: newWorkflow,
    };
  }

  if (action.type === CANCEL_WORKFLOW) {
    return {
      ...state,
      workflow: undefined,
    };
  }

  return state;
}
