// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';
import {
  ClientZkReceiptOperations,
  ReceiptCredential,
  ReceiptCredentialRequestContext,
  ReceiptCredentialResponse,
  ReceiptSerial,
  ServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';

import * as Bytes from '../Bytes';
import { donationStateSchema, paymentTypeSchema } from '../types/Donations';
import type {
  CardDetail,
  DonationReceipt,
  DonationWorkflow,
  ReceiptContext,
} from '../types/Donations';
import { getRandomBytes, sha256 } from '../Crypto';
import { DataWriter } from '../sql/Client';
import { createLogger } from '../logging/log';
import { donationValidationCompleteRoute } from '../util/signalRoutes';

const { createDonationReceipt } = DataWriter;

const log = createLogger('donations');

function redactId(id: string) {
  return `[REDACTED]${id.slice(-4)}`;
}

function hashIdToIdempotencyKey(id: string) {
  const idBytes = Bytes.fromString(id);
  const hashed = sha256(idBytes);
  return Buffer.from(hashed).toString('hex');
}

const RECEIPT_SERIAL_LENGTH = 16;

let isDonationInProgress = false;

export async function internalDoDonation({
  currencyType,
  paymentAmount,
  paymentDetail,
}: {
  currencyType: string;
  paymentAmount: number;
  paymentDetail: CardDetail;
}): Promise<void> {
  if (isDonationInProgress) {
    throw new Error("Can't proceed because a donation is in progress.");
  }

  try {
    isDonationInProgress = true;

    let workflow: DonationWorkflow;

    workflow = await createPaymentIntent({
      currencyType,
      paymentAmount,
    });
    window.reduxActions.donations.updateWorkflow(workflow);

    workflow = await createPaymentMethodForIntent(workflow, paymentDetail);
    window.reduxActions.donations.updateWorkflow(workflow);

    workflow = await confirmPayment(workflow);
    window.reduxActions.donations.updateWorkflow(workflow);

    workflow = await getReceipt(workflow);
    window.reduxActions.donations.updateWorkflow(workflow);

    workflow = await redeemReceipt(workflow);
    window.reduxActions.donations.updateWorkflow(workflow);

    workflow = await saveReceipt(workflow);
    window.reduxActions.donations.updateWorkflow(workflow);
  } finally {
    isDonationInProgress = false;
  }
}

export async function createPaymentIntent({
  currencyType,
  paymentAmount,
}: {
  currencyType: string;
  paymentAmount: number;
}): Promise<DonationWorkflow> {
  if (!window.textsecure.server) {
    throw new Error(
      'createPaymentIntent: window.textsecure.server is not available!'
    );
  }

  const id = uuid();
  const logId = `createPaymentIntent(${redactId(id)})`;
  log.info(`${logId}: Creating new workflow`);

  const payload = {
    currency: currencyType,
    amount: paymentAmount,
    level: 1,
    paymentMethod: 'CARD',
  };
  const { clientSecret } =
    await window.textsecure.server.createBoostPaymentIntent(payload);
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
}

export async function createPaymentMethodForIntent(
  workflow: DonationWorkflow,
  cardDetail: CardDetail
): Promise<DonationWorkflow> {
  const logId = `createPaymentMethodForIntent(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.INTENT) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} is not at type INTENT, unable to create payment method`
    );
  }
  if (!window.textsecure.server) {
    throw new Error(`${logId}: window.textsecure.server is not available!`);
  }

  log.info(`${logId}: Starting`);

  const { id: paymentMethodId } =
    await window.textsecure.server.createPaymentMethodWithStripe({
      cardDetail,
    });

  log.info(`${logId}: Successfully transitioned to INTENT_METHOD`);

  return {
    ...workflow,
    type: donationStateSchema.Enum.INTENT_METHOD,
    timestamp: Date.now(),
    paymentMethodId,
    paymentType: paymentTypeSchema.Enum.CARD,
    paymentDetail: {
      lastFourDigits: cardDetail.number.slice(-4),
    },
  };
}

export async function confirmPayment(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `confirmPayment(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.INTENT_METHOD) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} is not at type INTENT_METHOD, unable to confirm payment`
    );
  }
  if (!window.textsecure.server) {
    throw new Error(`${logId}: window.textsecure.server is not available!`);
  }

  log.info(`${logId}: Starting`);

  const serverPublicParams = new ServerPublicParams(
    Buffer.from(window.getServerPublicParams(), 'base64')
  );
  const zkReceipt = new ClientZkReceiptOperations(serverPublicParams);
  const receiptSerialData = getRandomBytes(RECEIPT_SERIAL_LENGTH);
  const receiptSerial = new ReceiptSerial(Buffer.from(receiptSerialData));
  const receiptCredentialRequestContext =
    zkReceipt.createReceiptCredentialRequestContext(receiptSerial);
  const receiptCredentialRequest = receiptCredentialRequestContext.getRequest();

  const receiptContext: ReceiptContext = {
    receiptCredentialRequestContextBase64: Bytes.toBase64(
      receiptCredentialRequestContext.serialize()
    ),
    receiptCredentialRequestBase64: Bytes.toBase64(
      receiptCredentialRequest.serialize()
    ),
  };

  const { clientSecret, paymentIntentId, paymentMethodId, id } = workflow;
  const idempotencyKey = hashIdToIdempotencyKey(id);
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

  const { next_action: nextAction } =
    await window.textsecure.server.confirmIntentWithStripe(options);

  // TODO: Support Redirect to URL
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
}

export async function completeValidationRedirect(
  workflow: DonationWorkflow,
  token: string
): Promise<DonationWorkflow> {
  const logId = `completeValidationRedirect(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.INTENT_REDIRECT) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} is not type INTENT_REDIRECT, unable to complete redirect`
    );
  }
  if (!window.textsecure.server) {
    throw new Error(`${logId}: window.textsecure.server is not available!`);
  }
  log.info(`${logId}: Starting`);

  if (token !== workflow.returnToken) {
    throw new Error(`${logId}: The provided token did not match saved token`);
  }

  log.info(
    `${logId}: Successfully transitioned to INTENT_CONFIRMED for workflow ${redactId(workflow.id)}`
  );

  return {
    ...workflow,
    type: donationStateSchema.Enum.INTENT_CONFIRMED,
    timestamp: Date.now(),
  };
}

export async function getReceipt(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `getReceipt(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.INTENT_CONFIRMED) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} not type INTENT_CONFIRMED, unable to get receipt`
    );
  }
  if (!window.textsecure.server) {
    throw new Error(`${logId}: window.textsecure.server is not available!`);
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
  const { receiptCredentialResponse: receiptCredentialResponseBase64 } =
    await window.textsecure.server.createBoostReceiptCredentials(jsonPayload);

  const receiptCredentialResponse = new ReceiptCredentialResponse(
    Buffer.from(receiptCredentialResponseBase64, 'base64')
  );
  const receiptCredentialRequestContext = new ReceiptCredentialRequestContext(
    Buffer.from(receiptCredentialRequestContextBase64, 'base64')
  );
  const serverPublicParams = new ServerPublicParams(
    Buffer.from(window.getServerPublicParams(), 'base64')
  );
  const zkReceipt = new ClientZkReceiptOperations(serverPublicParams);
  const receiptCredential = zkReceipt.receiveReceiptCredential(
    receiptCredentialRequestContext,
    receiptCredentialResponse
  );

  // TODO: Validate receiptCredential.level and expiration

  log.info(
    `${logId}: Successfully transitioned to RECEIPT for workflow ${redactId(workflow.id)}`
  );

  return {
    ...workflow,
    type: donationStateSchema.Enum.RECEIPT,
    timestamp: Date.now(),
    receiptCredentialBase64: Bytes.toBase64(receiptCredential.serialize()),
  };
}

export async function redeemReceipt(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `redeemReceipt(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.RECEIPT) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} not type RECEIPT, unable to redeem receipt`
    );
  }
  if (!window.textsecure.server) {
    throw new Error(`${logId}: window.textsecure.server is not available!`);
  }
  log.info(`${logId}: Starting`);

  const serverPublicParams = new ServerPublicParams(
    Buffer.from(window.getServerPublicParams(), 'base64')
  );
  const zkReceipt = new ClientZkReceiptOperations(serverPublicParams);
  const { receiptCredentialBase64 } = workflow;
  const receiptCredential = new ReceiptCredential(
    Buffer.from(receiptCredentialBase64, 'base64')
  );
  const receiptCredentialPresentation =
    zkReceipt.createReceiptCredentialPresentation(receiptCredential);
  const receiptCredentialPresentationBase64 = Bytes.toBase64(
    receiptCredentialPresentation.serialize()
  );
  const jsonPayload = {
    receiptCredentialPresentation: receiptCredentialPresentationBase64,
    visible: false,
    primary: false,
  };

  await window.textsecure.server.redeemReceipt(jsonPayload);

  log.info(`${logId}: Successfully transitioned to RECEIPT_REDEEMED`);

  return {
    ...workflow,
    type: donationStateSchema.Enum.RECEIPT_REDEEMED,
    timestamp: Date.now(),
  };
}

export async function saveReceipt(
  workflow: DonationWorkflow
): Promise<DonationWorkflow> {
  const logId = `saveReceipt(${redactId(workflow.id)})`;

  if (workflow.type !== donationStateSchema.Enum.RECEIPT_REDEEMED) {
    throw new Error(
      `${logId}: workflow at type ${workflow?.type} is not ready to save receipt`
    );
  }
  log.info(`${logId}: Starting`);

  // TODO: Should we generate a new UUID to break all links with Stripe?
  const donationReceipt: DonationReceipt = {
    id: workflow.id,
    currencyType: workflow.currencyType,
    paymentAmount: workflow.paymentAmount,
    timestamp: workflow.timestamp,
    paymentType: workflow.paymentType,
    paymentDetail: workflow.paymentDetail,
  };

  await createDonationReceipt(donationReceipt);

  log.info(`${logId}: Successfully saved receipt`);

  window.reduxActions.donations.addReceipt(donationReceipt);

  return {
    id: workflow.id,
    type: donationStateSchema.Enum.DONE,
  };
}
