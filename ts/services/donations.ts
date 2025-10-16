// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-await-in-loop */

import { v4 as uuid } from 'uuid';
import {
  ClientZkReceiptOperations,
  ReceiptCredential,
  ReceiptCredentialRequestContext,
  ReceiptCredentialResponse,
  ReceiptSerial,
  ServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup.js';
import * as countryCodes from 'country-codes-list';

import * as Bytes from '../Bytes.std.js';
import * as Errors from '../types/errors.std.js';
import { getRandomBytes, sha256 } from '../Crypto.node.js';
import { DataWriter } from '../sql/Client.preload.js';
import { createLogger } from '../logging/log.std.js';
import { getProfile } from '../util/getProfile.preload.js';
import { donationValidationCompleteRoute } from '../util/signalRoutes.std.js';
import { safeParseStrict, safeParseUnknown } from '../util/schemas.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { exponentialBackoffSleepTime } from '../util/exponentialBackoff.std.js';
import { sleeper } from '../util/sleeper.std.js';
import { isInPast, isOlderThan } from '../util/timestamp.std.js';
import { DAY, DurationInSeconds } from '../util/durations/index.std.js';
import { waitForOnline } from '../util/waitForOnline.dom.js';
import {
  donationErrorTypeSchema,
  donationStateSchema,
  donationWorkflowSchema,
} from '../types/Donations.std.js';

import type {
  CardDetail,
  DonationErrorType,
  DonationReceipt,
  DonationWorkflow,
  ReceiptContext,
  StripeDonationAmount,
} from '../types/Donations.std.js';
import { ToastType } from '../types/Toast.dom.js';
import { NavTab, SettingsPage } from '../types/Nav.std.js';
import { getRegionCodeForNumber } from '../util/libphonenumberUtil.std.js';
import {
  createBoostPaymentIntent,
  createPaymentMethodWithStripe,
  confirmIntentWithStripe,
  createBoostReceiptCredentials,
  redeemReceipt,
  isOnline,
} from '../textsecure/WebAPI.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { createDonationReceipt } = DataWriter;

const log = createLogger('donations');

function redactId(id: string) {
  return `[REDACTED]${id.slice(-4)}`;
}

function hashIdToIdempotencyKey(id: string, apiCallName: string) {
  const idBytes = Bytes.fromString(id + apiCallName);
  const hashed = sha256(idBytes);
  return Buffer.from(hashed).toString('hex');
}

const RECEIPT_SERIAL_LENGTH = 16;
const BOOST_LEVEL = 1;
const WORKFLOW_STORAGE_KEY = 'donationWorkflow';
const MAX_CREDENTIAL_EXPIRATION_IN_DAYS = 90;

let runDonationAbortController: AbortController | undefined;
let isInternalDonationInProgress = false;
let isDonationInProgress = false;
let isInitialized = false;

// Public API

// Starting everything up

export async function initialize(): Promise<void> {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  const workflow = _getWorkflowFromRedux();
  if (!workflow) {
    return;
  }

  const shouldShowToast =
    didResumeWorkflowAtStartup() && !isDonationPageVisible();
  const isTooOld = isOlderThan(workflow.timestamp, DAY);

  if (
    isTooOld &&
    (workflow.type === donationStateSchema.Enum.INTENT_METHOD ||
      workflow.type === donationStateSchema.Enum.INTENT_REDIRECT)
  ) {
    log.info(
      `initialize: Workflow at ${workflow.type} is too old, canceling donation.`
    );
    await clearDonation();
    await failDonation(donationErrorTypeSchema.Enum.TimedOut);

    return;
  }

  if (workflow.type === donationStateSchema.Enum.INTENT_METHOD) {
    if (shouldShowToast) {
      log.info(
        'initialize: Showing confirmation toast, workflow is at INTENT_METHOD.'
      );
      window.reduxActions.toast.showToast({
        toastType: ToastType.DonationConfirmationNeeded,
      });
    }

    // Note that we are not starting the workflow here
    return;
  }

  if (shouldShowToast) {
    log.info(
      'initialize: We resumed at startup and donation page not visible. Showing processing toast.'
    );
    window.reduxActions.toast.showToast({
      toastType: ToastType.DonationProcessing,
    });
  }

  await _runDonationWorkflow();
}

// These are the five moments the user provides input to the donation workflow. So,
// UI calls these methods directly; everything else happens automatically.

export async function startDonation({
  currencyType,
  paymentAmount,
}: {
  currencyType: string;
  paymentAmount: StripeDonationAmount;
}): Promise<void> {
  const workflow = await _createPaymentIntent({
    currencyType,
    paymentAmount,
    workflow: _getWorkflowFromRedux(),
  });

  // We don't run the workflow, because there's nothing else to do after this first step
  await _saveWorkflow(workflow);
}

export async function finishDonationWithCard(
  paymentDetail: CardDetail
): Promise<void> {
  const existing = _getWorkflowFromRedux();
  if (!existing) {
    throw new Error(
      'finishDonationWithCard: Cannot finish nonexistent workflow!'
    );
  }
  let workflow: DonationWorkflow;

  try {
    workflow = await _createPaymentMethodForIntent(existing, paymentDetail);
  } catch (error) {
    const errorType: string | undefined = error.response?.error?.type;
    if (error.code >= 400 && error.code <= 499 && errorType === 'card_error') {
      await failDonation(
        donationErrorTypeSchema.Enum.PaymentDeclined,
        errorType
      );
    } else {
      await failDonation(donationErrorTypeSchema.Enum.GeneralError, errorType);
    }

    throw error;
  }

  // We run the workflow; it might be that no further user input is required!
  await _saveAndRunWorkflow(workflow);
}

export async function finish3dsValidation(token: string): Promise<void> {
  let workflow: DonationWorkflow;

  try {
    const existing = _getWorkflowFromRedux();
    if (!existing) {
      throw new Error(
        'finish3dsValidation: Cannot finish nonexistent workflow!'
      );
    }

    workflow = await _completeValidationRedirect(existing, token);
  } catch (error) {
    await failDonation(donationErrorTypeSchema.Enum.Failed3dsValidation);
    throw error;
  }

  await _saveAndRunWorkflow(workflow);
}

export async function clearDonation(): Promise<void> {
  runDonationAbortController?.abort();
  await _saveWorkflow(undefined);
}

export async function resumeDonation(): Promise<void> {
  const existing = _getWorkflowFromRedux();
  if (!existing) {
    throw new Error('resumeDonation: Cannot finish nonexistent workflow!');
  }

  await _saveAndRunWorkflow(existing);
}

// For testing

export async function _internalDoDonation({
  currencyType,
  paymentAmount,
  paymentDetail,
}: {
  currencyType: string;
  paymentAmount: StripeDonationAmount;
  paymentDetail: CardDetail;
}): Promise<void> {
  if (isInternalDonationInProgress) {
    throw new Error("Can't proceed because a donation is in progress.");
  }

  try {
    isInternalDonationInProgress = true;

    let workflow: DonationWorkflow;

    workflow = await _createPaymentIntent({
      currencyType,
      paymentAmount,
      workflow: undefined,
    });
    await _saveWorkflow(workflow);

    workflow = await _createPaymentMethodForIntent(workflow, paymentDetail);
    await _saveAndRunWorkflow(workflow);
  } catch (error) {
    const errorType: string | undefined = error.response?.error?.type;
    await failDonation(donationErrorTypeSchema.Enum.GeneralError, errorType);
  } finally {
    isInternalDonationInProgress = false;
  }
}

// High-level functions to move things forward

export async function _saveAndRunWorkflow(
  workflow: DonationWorkflow | undefined
): Promise<void> {
  const logId = `_saveAndRunWorkflow(${workflow?.id ? redactId(workflow.id) : 'NONE'}`;
  await _saveWorkflow(workflow);

  if (isDonationInProgress) {
    log.info(
      `${logId}: Donation workflow is already running; not calling it again`
    );
    return;
  }
  if (!workflow) {
    log.info(`${logId}: No need to start workflow; it's been cleared`);
  }

  await _runDonationWorkflow();
}

export async function _runDonationWorkflow(): Promise<void> {
  let logId = '_runDonationWorkflow';

  let totalCount = 0;
  let backoffCount = 0;

  try {
    if (isDonationInProgress) {
      log.warn(`${logId}: Can't proceed because a donation is in progress.`);
      return;
    }
    isDonationInProgress = true;
    runDonationAbortController = new AbortController();

    // We will loop until we explicitly return or throw
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = _getWorkflowFromRedux();
      const idForLog = existing?.id ? redactId(existing.id) : 'NONE';
      logId = `runDonationWorkflow(${idForLog})`;

      if (!existing) {
        log.info(`${logId}: No workflow to process. Returning.`);
        return;
      }

      const { type, timestamp } = existing;
      if (isOlderThan(timestamp, DAY * 90)) {
        log.info(
          `${logId}: Workflow timestamp is more than 90 days ago. Clearing.`
        );
        await failDonation(donationErrorTypeSchema.Enum.GeneralError);
        return;
      }

      totalCount += 1;
      if (totalCount === 1) {
        log.info(`${logId}: Starting, with state of ${type}...`);
      } else {
        log.info(
          `${logId}: Continuing at count ${totalCount}, with state of ${type}...`
        );
      }

      if (runDonationAbortController?.signal.aborted) {
        log.info(`${logId}: abortController is aborted. Returning`);
        return;
      }

      if (!isOnline()) {
        log.info(`${logId}: We are not online; waiting until we are online`);
        await waitForOnline({ server: { isOnline } });
        log.info(`${logId}: We are back online; starting up again`);
      }

      backoffCount += 1;
      const sleepTime = exponentialBackoffSleepTime(backoffCount);
      if (sleepTime > 0) {
        const detail = `${logId}: sleeping for backoff for ${type}, backoff count is ${backoffCount}`;
        log.info(detail);
        await sleeper.sleep(sleepTime, detail);
      }

      try {
        let updated: DonationWorkflow;

        if (type === donationStateSchema.Enum.INTENT) {
          log.info(`${logId}: Waiting for payment details. Returning.`);
          return;
        }
        if (type === donationStateSchema.Enum.INTENT_METHOD) {
          if (didResumeWorkflowAtStartup()) {
            log.info(
              `${logId}: Resumed after startup and haven't charged payment method. Waiting for user confirmation.`
            );
            return;
          }

          log.info(`${logId}: Attempting to confirm payment`);
          updated = await _confirmPayment(existing);
          // continuing
        } else if (type === donationStateSchema.Enum.INTENT_REDIRECT) {
          log.info(
            `${logId}: Waiting for user to return from confirmation URL. Returning.`
          );
          if (!isDonationPageVisible()) {
            log.info(
              `${logId}: Donation page not visible. Showing verification needed toast.`
            );
            window.reduxActions.toast.showToast({
              toastType: ToastType.DonationVerificationNeeded,
            });
          }
          return;
        } else if (type === donationStateSchema.Enum.INTENT_CONFIRMED) {
          log.info(`${logId}: Attempting to get receipt`);
          updated = await _getReceipt(existing);
          // continuing
        } else if (type === donationStateSchema.Enum.RECEIPT) {
          log.info(`${logId}: Attempting to redeem receipt`);
          updated = await _redeemReceipt(existing);
          // continuing
        } else if (type === donationStateSchema.Enum.DONE) {
          if (isDonationPageVisible()) {
            if (isDonationsDonateFlowVisible()) {
              window.reduxActions.nav.changeLocation({
                tab: NavTab.Settings,
                details: {
                  page: SettingsPage.Donations,
                },
              });
            }
          } else {
            log.info(
              `${logId}: Donation page not visible. Showing complete toast.`
            );
            window.reduxActions.toast.showToast({
              toastType: ToastType.DonationCompleted,
            });
          }

          log.info(`${logId}: Workflow is complete. Returning.`);
          return;
        } else {
          throw missingCaseError(type);
        }

        const isAborted = runDonationAbortController?.signal.aborted;
        if (isAborted) {
          log.info(`${logId}: abortController is aborted. Returning`);
          return;
        }

        if (updated.type !== type) {
          backoffCount = 0;
        }

        await _saveWorkflow(updated);
      } catch (error) {
        const errorType: string | undefined = error.response?.error?.type;

        if (
          error.name === 'HTTPError' &&
          error.code >= 400 &&
          error.code <= 499
        ) {
          log.warn(`${logId}: Got a ${error.code} error. Failing donation.`);
          if (
            type === donationStateSchema.Enum.INTENT_METHOD &&
            errorType === 'card_error'
          ) {
            await failDonation(
              donationErrorTypeSchema.Enum.PaymentDeclined,
              errorType
            );
          } else {
            await failDonation(
              donationErrorTypeSchema.Enum.GeneralError,
              errorType
            );
          }
          throw error;
        }

        if (error.name === 'HTTPError' && typeof error.code === 'number') {
          log.warn(`${logId}: Got a ${error.code} error, retrying donation`);
          // continuing
        } else {
          log.warn(
            `${logId}: Donation step threw unexpectedly. Failing donation. ${Errors.toLogFormat(error)}`
          );
          await failDonation(
            donationErrorTypeSchema.Enum.GeneralError,
            errorType
          );
          throw error;
        }
      }
    }
  } finally {
    isDonationInProgress = false;
    runDonationAbortController = undefined;
  }
}

// Workflow steps

let isDonationStepInProgress = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withConcurrencyCheck<T extends () => Promise<any>>(
  name: string,
  fn: T
): Promise<ReturnType<T>> {
  if (isDonationStepInProgress) {
    throw new Error(
      `${name}: Can't proceed because a donation step is already in progress.`
    );
  }
  isDonationStepInProgress = true;

  try {
    return fn();
  } finally {
    isDonationStepInProgress = false;
  }
}

export async function _createPaymentIntent({
  currencyType,
  paymentAmount,
  workflow,
}: {
  currencyType: string;
  paymentAmount: StripeDonationAmount;
  workflow: DonationWorkflow | undefined;
}): Promise<DonationWorkflow> {
  const id = uuid();
  const logId = `_createPaymentIntent(${redactId(id)})`;

  return withConcurrencyCheck(logId, async () => {
    if (workflow && workflow.type !== donationStateSchema.Enum.DONE) {
      throw new Error(
        `${logId}: existing workflow at type ${workflow.type} is not at type DONE, unable to create payment intent`
      );
    }

    log.info(`${logId}: Creating new workflow`);

    const payload = {
      currency: currencyType,
      amount: paymentAmount,
      level: 1,
      paymentMethod: 'CARD',
    };
    const { clientSecret } = await createBoostPaymentIntent(payload);
    const paymentIntentId = clientSecret.split('_secret_')[0];

    log.info(`${logId}: Successfully transitioned to INTENT`);

    return {
      type: donationStateSchema.Enum.INTENT,
      id,
      currencyType,
      paymentAmount,
      paymentIntentId,
      clientSecret,
      returnToken: uuid(),
      timestamp: Date.now(),
    };
  });
}

export async function _createPaymentMethodForIntent(
  workflow: DonationWorkflow,
  cardDetail: CardDetail
): Promise<DonationWorkflow> {
  const logId = `_createPaymentMethodForIntent(${redactId(workflow.id)})`;

  return withConcurrencyCheck(logId, async () => {
    // We need to handle INTENT_METHOD so user can fix their payment info and try again
    if (
      workflow.type !== donationStateSchema.Enum.INTENT &&
      workflow.type !== donationStateSchema.Enum.INTENT_METHOD
    ) {
      throw new Error(
        `${logId}: workflow at type ${workflow?.type} is not at type INTENT or INTENT_METHOD, unable to create payment method`
      );
    }

    log.info(`${logId}: Starting`);

    const { id: paymentMethodId } = await createPaymentMethodWithStripe({
      cardDetail,
    });

    log.info(`${logId}: Successfully transitioned to INTENT_METHOD`);

    return {
      ...workflow,
      type: donationStateSchema.Enum.INTENT_METHOD,
      timestamp: Date.now(),
      paymentMethodId,
    };
  });
}

export async function _confirmPayment(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `_confirmPayment(${redactId(workflow.id)})`;

  return withConcurrencyCheck(logId, async () => {
    if (workflow.type !== donationStateSchema.Enum.INTENT_METHOD) {
      throw new Error(
        `${logId}: workflow at type ${workflow?.type} is not at type INTENT_METHOD, unable to confirm payment`
      );
    }

    log.info(`${logId}: Starting`);

    const receiptContext = getReceiptContext();

    const { clientSecret, paymentIntentId, paymentMethodId, id } = workflow;
    const idempotencyKey = hashIdToIdempotencyKey(
      id,
      `confirmPayment/${paymentMethodId}`
    );
    const returnUrl = donationValidationCompleteRoute
      .toAppUrl({ token: workflow.returnToken })
      .toString();
    const options = {
      clientSecret,
      idempotencyKey,
      paymentIntentId,
      paymentMethodId,
      returnUrl,
    };

    const { next_action: nextAction } = await confirmIntentWithStripe(options);

    if (nextAction && nextAction.type === 'redirect_to_url') {
      const { redirect_to_url: redirectDetails } = nextAction;

      if (!redirectDetails || !redirectDetails.url) {
        throw new Error(
          `${logId}: nextAction type was redirect_to_url, but no url was supplied!`
        );
      }

      log.info(`${logId}: Successfully transitioned to INTENT_REDIRECT`);

      return {
        ...workflow,
        ...receiptContext,
        type: donationStateSchema.Enum.INTENT_REDIRECT,
        timestamp: Date.now(),
        redirectTarget: redirectDetails.url,
      };
    }

    if (nextAction) {
      throw new Error(
        `${logId}: Unsupported nextAction type ${nextAction.type}!`
      );
    }

    log.info(`${logId}: Successfully transitioned to INTENT_CONFIRMED`);

    return {
      ...workflow,
      ...receiptContext,
      type: donationStateSchema.Enum.INTENT_CONFIRMED,
      timestamp: Date.now(),
    };
  });
}

export async function _completeValidationRedirect(
  workflow: DonationWorkflow,
  token: string
): Promise<DonationWorkflow> {
  const logId = `_completeValidationRedirect(${redactId(workflow.id)})`;

  return withConcurrencyCheck(logId, async () => {
    if (workflow.type !== donationStateSchema.Enum.INTENT_REDIRECT) {
      throw new Error(
        `${logId}: workflow at type ${workflow?.type} is not type INTENT_REDIRECT, unable to complete redirect`
      );
    }

    log.info(`${logId}: Starting`);

    if (token !== workflow.returnToken) {
      throw new Error(`${logId}: The provided token did not match saved token`);
    }

    log.info(`${logId}: Successfully transitioned to INTENT_CONFIRMED`);

    return {
      ...workflow,
      type: donationStateSchema.Enum.INTENT_CONFIRMED,
      timestamp: Date.now(),
    };
  });
}

export async function _getReceipt(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `_getReceipt(${redactId(workflow.id)})`;

  return withConcurrencyCheck(logId, async () => {
    if (workflow.type !== donationStateSchema.Enum.INTENT_CONFIRMED) {
      throw new Error(
        `${logId}: workflow at type ${workflow?.type} not type INTENT_CONFIRMED, unable to get receipt`
      );
    }

    log.info(`${logId}: Starting`);

    const {
      paymentIntentId,
      receiptCredentialRequestBase64,
      receiptCredentialRequestContextBase64,
    } = workflow;
    const jsonPayload = {
      paymentIntentId,
      receiptCredentialRequest: receiptCredentialRequestBase64,
      processor: 'STRIPE',
    };

    // Payment could ultimately fail here, especially with other payment types
    // If 204, use exponential backoff - payment hasn't gone through yet
    // if 409, something has gone strangely wrong - we're using a different
    //   credentialRequest for the same paymentIntentId
    let responseWithDetails;
    try {
      responseWithDetails = await createBoostReceiptCredentials(jsonPayload);
    } catch (error) {
      if (error.code === 409) {
        // Save for the user's tax records even if something went wrong with credential
        await saveReceipt(workflow, logId);
        throw new Error(
          `${logId}: Got 409 when attempting to get receipt; failing donation`
        );
      }

      throw error;
    }

    if (responseWithDetails.response.status === 204) {
      log.info(
        `${logId}: Payment is still processing, leaving workflow at INTENT_CONFIRMED`
      );
      return workflow;
    }
    const { receiptCredentialResponse: receiptCredentialResponseBase64 } =
      responseWithDetails.data;

    const receiptCredential = generateCredential(
      receiptCredentialResponseBase64,
      receiptCredentialRequestContextBase64
    );

    const isValid = isCredentialValid(receiptCredential);
    if (!isValid) {
      // Save for the user's tax records even if something went wrong with credential
      await saveReceipt(workflow, logId);
      throw new Error(
        `${logId}: Credential returned for donation is invalid; failing donation`
      );
    }

    log.info(`${logId}: Successfully transitioned to RECEIPT`);

    // At this point we know that the payment went through, so we save the receipt now.
    // If the redemption never happens, or fails, the user has it for their tax records.
    await saveReceipt(workflow, logId);

    return {
      ...workflow,
      type: donationStateSchema.Enum.RECEIPT,
      timestamp: Date.now(),
      receiptCredentialBase64: Bytes.toBase64(receiptCredential.serialize()),
    };
  });
}

export async function _redeemReceipt(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `_redeemReceipt(${redactId(workflow.id)})`;

  return withConcurrencyCheck(logId, async () => {
    if (workflow.type !== donationStateSchema.Enum.RECEIPT) {
      throw new Error(
        `${logId}: workflow at type ${workflow?.type} not type RECEIPT, unable to redeem receipt`
      );
    }

    log.info(`${logId}: Starting`);

    const receiptCredentialPresentation = generateReceiptCredentialPresentation(
      workflow.receiptCredentialBase64
    );
    const receiptCredentialPresentationBase64 = Bytes.toBase64(
      receiptCredentialPresentation.serialize()
    );

    const me = window.ConversationController.getOurConversationOrThrow();
    const myBadges = me.attributes.badges;

    const jsonPayload = {
      receiptCredentialPresentation: receiptCredentialPresentationBase64,
      visible:
        !!myBadges &&
        myBadges.length > 0 &&
        myBadges.every(myBadge => 'isVisible' in myBadge && myBadge.isVisible),
      primary: false,
    };

    await redeemReceipt(jsonPayload);

    // After the receipt credential, our profile will change to add new badges.
    // Refresh our profile to get new badges.
    await getProfile({
      serviceId: me.getServiceId() ?? null,
      e164: me.get('e164') ?? null,
      groupId: null,
    });

    log.info(`${logId}: Successfully transitioned to DONE`);

    return {
      type: donationStateSchema.Enum.DONE,
      id: workflow.id,
      timestamp: Date.now(),
    };
  });
}

// Helper functions

async function failDonation(
  errorType: DonationErrorType,
  details: string | undefined = undefined
): Promise<void> {
  const workflow = _getWorkflowFromRedux();
  const logId = `failDonation(${workflow?.id ? redactId(workflow.id) : 'NONE'})`;

  // We clear the workflow if we didn't just get user input
  if (
    workflow &&
    workflow.type !== donationStateSchema.Enum.INTENT_METHOD &&
    workflow.type !== donationStateSchema.Enum.INTENT &&
    workflow.type !== donationStateSchema.Enum.INTENT_REDIRECT
  ) {
    await _saveWorkflow(undefined);
  }

  log.info(
    `failDonation: Failing with type ${errorType} ${details ? `details=${details}` : ''}`
  );
  if (!isDonationPageVisible()) {
    if (errorType === donationErrorTypeSchema.Enum.Failed3dsValidation) {
      log.info(
        `${logId}: Donation page not visible. Showing 'verification failed' toast.`
      );
      window.reduxActions.toast.showToast({
        toastType: ToastType.DonationVerificationFailed,
      });
    } else if (errorType === donationErrorTypeSchema.Enum.TimedOut) {
      log.info(
        `${logId}: Donation page not visible. Showing 'donation canceled w/view' toast.`
      );
      window.reduxActions.toast.showToast({
        toastType: ToastType.DonationCanceledWithView,
      });
    } else {
      log.info(
        `${logId}: Donation page not visible. Showing 'error processing donation' toast.`
      );
      window.reduxActions.toast.showToast({
        toastType: ToastType.DonationError,
      });
    }
  }

  window.reduxActions.donations.updateLastError(errorType);
}
async function _saveWorkflow(
  workflow: DonationWorkflow | undefined
): Promise<void> {
  await _saveWorkflowToStorage(workflow);
  _saveWorkflowToRedux(workflow);
}
export function _getWorkflowFromRedux(): DonationWorkflow | undefined {
  return window.reduxStore.getState().donations.currentWorkflow;
}
export function _saveWorkflowToRedux(
  workflow: DonationWorkflow | undefined
): void {
  window.reduxActions.donations.updateWorkflow(workflow);
}

export function _getWorkflowFromStorage(): DonationWorkflow | undefined {
  const logId = '_getWorkflowFromStorage';
  const workflowJson = itemStorage.get(WORKFLOW_STORAGE_KEY);

  if (!workflowJson) {
    log.info(`${logId}: No workflow found in storage`);
    return undefined;
  }

  const workflowData = JSON.parse(workflowJson) as unknown;
  const result = safeParseUnknown(donationWorkflowSchema, workflowData);
  if (!result.success) {
    log.error(
      `${logId}: Workflow from storage was malformed: ${result.error.flatten()}`
    );
    return undefined;
  }

  const workflow = result.data;
  if (workflow.type === donationStateSchema.Enum.INTENT) {
    log.info(`${logId}: Found existing workflow at type INTENT, dropping.`);
    return undefined;
  }

  log.info(`${logId}: Found existing workflow from storage`);
  return workflow;
}
export async function _saveWorkflowToStorage(
  workflow: DonationWorkflow | undefined
): Promise<void> {
  const logId = `_saveWorkflowToStorage(${workflow?.id ? redactId(workflow.id) : 'NONE'}`;
  if (!workflow) {
    log.info(`${logId}: Clearing workflow`);
    await itemStorage.remove(WORKFLOW_STORAGE_KEY);
    return;
  }

  const result = safeParseStrict(donationWorkflowSchema, workflow);
  if (!result.success) {
    log.error(
      `${logId}: Provided workflow was malformed: ${result.error.flatten()}`
    );
    throw result.error;
  }

  await itemStorage.put(WORKFLOW_STORAGE_KEY, JSON.stringify(workflow));
  log.info(`${logId}: Saved workflow to storage`);
}

async function saveReceipt(workflow: DonationWorkflow, logId: string) {
  if (
    workflow.type !== donationStateSchema.Enum.RECEIPT &&
    workflow.type !== donationStateSchema.Enum.INTENT_CONFIRMED
  ) {
    throw new Error(
      `${logId}: Cannot save receipt from workflow at type ${workflow?.type}`
    );
  }
  const donationReceipt: DonationReceipt = {
    id: workflow.id,
    currencyType: workflow.currencyType,
    paymentAmount: workflow.paymentAmount,
    // This will be when we transitioned to INTENT_CONFIRMED, most likely. It may be close
    // to when the user clicks the Donate button, or delayed by a bit.
    timestamp: workflow.timestamp,
  };

  await createDonationReceipt(donationReceipt);
  window.reduxActions.donations.addReceipt(donationReceipt);

  log.info(`${logId}: Successfully saved receipt`);
}

function didResumeWorkflowAtStartup() {
  return window.reduxStore.getState().donations.didResumeWorkflowAtStartup;
}

function isDonationPageVisible() {
  const { selectedLocation } = window.reduxStore.getState().nav;
  return (
    selectedLocation.tab === NavTab.Settings &&
    (selectedLocation.details.page === SettingsPage.Donations ||
      selectedLocation.details.page === SettingsPage.DonationsDonateFlow ||
      selectedLocation.details.page === SettingsPage.DonationsReceiptList)
  );
}

function isDonationsDonateFlowVisible() {
  const { selectedLocation } = window.reduxStore.getState().nav;
  return (
    selectedLocation.tab === NavTab.Settings &&
    selectedLocation.details.page === SettingsPage.DonationsDonateFlow
  );
}

// Working with zkgroup receipts

function getServerPublicParams(): ServerPublicParams {
  return new ServerPublicParams(
    Buffer.from(window.getServerPublicParams(), 'base64')
  );
}

function getZkReceiptOperations(): ClientZkReceiptOperations {
  const serverPublicParams = getServerPublicParams();
  return new ClientZkReceiptOperations(serverPublicParams);
}

function getReceiptContext(): ReceiptContext {
  const zkReceipt = getZkReceiptOperations();
  const receiptSerialData = getRandomBytes(RECEIPT_SERIAL_LENGTH);
  const receiptSerial = new ReceiptSerial(Buffer.from(receiptSerialData));
  const receiptCredentialRequestContext =
    zkReceipt.createReceiptCredentialRequestContext(receiptSerial);
  const receiptCredentialRequest = receiptCredentialRequestContext.getRequest();

  return {
    receiptCredentialRequestContextBase64: Bytes.toBase64(
      receiptCredentialRequestContext.serialize()
    ),
    receiptCredentialRequestBase64: Bytes.toBase64(
      receiptCredentialRequest.serialize()
    ),
  };
}

function generateCredential(
  receiptCredentialResponseBase64: string,
  receiptCredentialRequestContextBase64: string
) {
  const zkReceipt = getZkReceiptOperations();
  const receiptCredentialResponse = new ReceiptCredentialResponse(
    Buffer.from(receiptCredentialResponseBase64, 'base64')
  );
  const receiptCredentialRequestContext = new ReceiptCredentialRequestContext(
    Buffer.from(receiptCredentialRequestContextBase64, 'base64')
  );

  return zkReceipt.receiveReceiptCredential(
    receiptCredentialRequestContext,
    receiptCredentialResponse
  );
}

function generateReceiptCredentialPresentation(
  receiptCredentialBase64: string
) {
  const zkReceipt = getZkReceiptOperations();
  const receiptCredential = new ReceiptCredential(
    Buffer.from(receiptCredentialBase64, 'base64')
  );
  const receiptCredentialPresentation =
    zkReceipt.createReceiptCredentialPresentation(receiptCredential);
  return receiptCredentialPresentation;
}

function isCredentialValid(credential: ReceiptCredential): boolean {
  const logId = 'isCredentialValid';

  const level = credential.getReceiptLevel();
  if (level !== BigInt(BOOST_LEVEL)) {
    log.warn(`${logId}: Expected level to be ${BOOST_LEVEL}, but was ${level}`);
    return false;
  }

  const expirationTime = DurationInSeconds.toMillis(
    DurationInSeconds.fromSeconds(credential.getReceiptExpirationTime())
  );
  if (expirationTime % DAY !== 0) {
    log.warn(
      `${logId}: Expiration of ${expirationTime} was not divisible by ${DAY}`
    );
    return false;
  }
  if (isInPast(expirationTime)) {
    log.warn(`${logId}: Expiration of ${expirationTime} is in the past`);
    return false;
  }

  const maxExpiration = Date.now() + DAY * MAX_CREDENTIAL_EXPIRATION_IN_DAYS;
  if (expirationTime > maxExpiration) {
    log.warn(
      `${logId}: Expiration of ${expirationTime} is greater than max expiration: ${maxExpiration}`
    );
    return false;
  }

  return true;
}

export function phoneNumberToCurrencyCode(e164: string): string {
  const regionCode = getRegionCodeForNumber(e164) ?? 'US';
  const countryData = countryCodes.findOne('countryCode', regionCode);
  return countryData?.currencyCode ?? 'USD';
}
