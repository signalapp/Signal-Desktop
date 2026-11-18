// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum LinkDeviceWorkflowStage {
  ConfirmingWithOS = 'ConfirmingWithOS',
  ScanningQRCode = 'ScanningQRCode',
  ChoosingTransferMessages = 'ChoosingTransferMessages',
  SendingProvisioningMessage = 'SendingProvisioningMessage',
  WaitingForLinkComplete = 'WaitingForLinkComplete',
  TransferringMessages = 'TransferringMessages',
  Error = 'Error',
}

// A few special-cases are always allowed:
//   1. You can always return to the initial ConfirmingWithOS stage
//   2. You can always make an update to the existing stage
//   3. You can always go to the Error stage
export const ValidNextStages: Record<
  LinkDeviceWorkflowStage,
  Set<LinkDeviceWorkflowStage>
> = {
  [LinkDeviceWorkflowStage.ConfirmingWithOS]: new Set([
    LinkDeviceWorkflowStage.ScanningQRCode,
  ]),
  [LinkDeviceWorkflowStage.ScanningQRCode]: new Set([
    LinkDeviceWorkflowStage.ChoosingTransferMessages,
    LinkDeviceWorkflowStage.SendingProvisioningMessage, // We go directly to send if device doesn't support link'n'sync
  ]),
  [LinkDeviceWorkflowStage.ChoosingTransferMessages]: new Set([
    LinkDeviceWorkflowStage.SendingProvisioningMessage,
  ]),
  [LinkDeviceWorkflowStage.SendingProvisioningMessage]: new Set([
    LinkDeviceWorkflowStage.WaitingForLinkComplete,
  ]),
  [LinkDeviceWorkflowStage.WaitingForLinkComplete]: new Set([
    LinkDeviceWorkflowStage.TransferringMessages,
  ]),
  [LinkDeviceWorkflowStage.TransferringMessages]: new Set([]),
  [LinkDeviceWorkflowStage.Error]: new Set([
    LinkDeviceWorkflowStage.ScanningQRCode, // If the user chooses Retry, we skip OS validation
  ]),
};

// There's no 'complete' stage, just a check we do when we are done
export const ValidStepsBeforeComplete = new Set([
  LinkDeviceWorkflowStage.TransferringMessages,
  LinkDeviceWorkflowStage.WaitingForLinkComplete, // If no link'n'sync, we're done!
]);

export type TransferMessagesLinkingProgress =
  | {
      totalBytes: number;
      currentBytes: number;
    }
  | undefined;

export enum LinkedDeviceCapabilities {
  nopni = 'nopni', // legacy e164-less linking
  nopni2 = 'nopni2', // e164-less linking
  backup5 = 'backup5', // link'n'sync support
  // wifiaware = 'wifiaware', // ios-only direct transfer
}

export type CandidateDeviceInfo = {
  publicKey: Uint8Array<ArrayBuffer>;
  address: string;
  capabilities: ReadonlyArray<LinkedDeviceCapabilities>;
};

export type ConfirmingWithOSStage = {
  // A UI-only step, ensuring that the user really wants to do this
  stage: LinkDeviceWorkflowStage.ConfirmingWithOS;
};
export type ScanningQRCodeStage = {
  // By scanning a QR code, data is retrieved from the candidate linked device.
  stage: LinkDeviceWorkflowStage.ScanningQRCode;
};

export type ChoosingTransferMessagesStage = {
  // Link'n'Sync is shown the to the user as 'Transfer Messages'
  stage: LinkDeviceWorkflowStage.ChoosingTransferMessages;
  // Used to send the provision message (next step), but it comes from an earlier step
  candidateDeviceInfo: CandidateDeviceInfo;
};

export type SendingProvisioningMessageStage = {
  // First we fetch a verificationCode and tokenIdentifier from the server, then we
  // send necessary data to the candidate linked device: the ProvisionMessage proto
  stage: LinkDeviceWorkflowStage.SendingProvisioningMessage;
  willTransferMessages: boolean;
  abortController: AbortController;
};

export type WaitingForLinkCompleteStage = {
  // Now that the ball is in the candidate linked device's court, we wait for it. If
  // the user did not choose Link'n'Sync, there is no UI at this stage, just a toast
  // when the process completes. If doing Link'n'Sync, we show a progress dialog.
  stage: LinkDeviceWorkflowStage.WaitingForLinkComplete;
  transferMessagesData:
    | {
        ephemeralBackupKey: Uint8Array<ArrayBuffer>;
      }
    | undefined;
  tokenIdentifier: string;
  abortController: AbortController;
};

export type TransferringMessagesStage = {
  // We show a progress dialog to the user while we run a local backup and upload it.
  stage: LinkDeviceWorkflowStage.TransferringMessages;
  deviceId: number;
  deviceRegistrationId: number;
  ephemeralBackupKey: Uint8Array<ArrayBuffer>;
  progress: TransferMessagesLinkingProgress;
  error?: 'not-enough-space' | 'failed-to-upload' | 'failed-to-make-backup';
  abortController: AbortController;
};

export type ErrorStage = {
  // Not a normal stage: Something went wrong, and we need to show error to the user
  stage: LinkDeviceWorkflowStage.Error;
};

export type LinkDeviceWorkflow =
  | ConfirmingWithOSStage
  | ScanningQRCodeStage
  | ChoosingTransferMessagesStage
  | SendingProvisioningMessageStage
  | WaitingForLinkCompleteStage
  | TransferringMessagesStage
  | ErrorStage;
