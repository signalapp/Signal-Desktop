// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';

import * as Errors from '../../types/errors';
import { safeParseLoose } from '../../util/schemas';
import { sql } from '../util';
import { sqlLogger } from '../sqlLogger';
import { donationReceiptSchema } from '../../types/Donations';

import type { DonationReceipt } from '../../types/Donations';
import type { ReadableDB, WritableDB } from '../Interface';

type DonationReceiptForDatabase = Readonly<
  {
    paymentDetailJson: string;
    paymentType: string;
  } & Omit<DonationReceipt, 'paymentType' | 'paymentDetail'>
>;

function hydrateDonationReceipt(
  receipt: DonationReceiptForDatabase
): DonationReceipt {
  const readyForParse = {
    ...omit(receipt, ['paymentDetailJson']),
    paymentDetail: JSON.parse(receipt.paymentDetailJson),
  };

  const result = safeParseLoose(donationReceiptSchema, readyForParse);
  if (result.success) {
    return result.data;
  }

  sqlLogger.error(
    `hydrateDonationReceipt: Parse failed for payment type ${readyForParse.paymentType}:`,
    Errors.toLogFormat(result.error)
  );
  const toFix = readyForParse as unknown as DonationReceipt;
  toFix.paymentDetail = null;
  return toFix;
}
export function freezeDonationReceipt(
  receipt: DonationReceipt
): DonationReceiptForDatabase {
  return {
    ...omit(receipt, ['paymentDetail']),
    paymentDetailJson: JSON.stringify(receipt.paymentDetail),
  };
}

export function getAllDonationReceipts(db: ReadableDB): Array<DonationReceipt> {
  const donationReceipts = db
    .prepare('SELECT * FROM donationReceipts ORDER BY timestamp DESC;')
    .all<DonationReceiptForDatabase>();

  return donationReceipts.map(hydrateDonationReceipt);
}
export function getDonationReceiptById(
  db: ReadableDB,
  id: string
): DonationReceipt | undefined {
  const [query, parameters] =
    sql`SELECT * FROM donationReceipts WHERE id = ${id}`;
  const fromDatabase = db
    .prepare(query)
    .get<DonationReceiptForDatabase>(parameters);

  if (fromDatabase) {
    return hydrateDonationReceipt(fromDatabase);
  }

  return undefined;
}
export function _deleteAllDonationReceipts(db: WritableDB): void {
  db.prepare('DELETE FROM donationReceipts;').run();
}
export function deleteDonationReceiptById(db: WritableDB, id: string): void {
  const [query, parameters] =
    sql`DELETE FROM donationReceipts WHERE id = ${id};`;
  db.prepare(query).run(parameters);
}
export function createDonationReceipt(
  db: WritableDB,
  receipt: DonationReceipt
): void {
  const forDatabase = freezeDonationReceipt(receipt);

  db.prepare(
    `
      INSERT INTO donationReceipts(
        id,
        currencyType,
        paymentAmount,
        paymentDetailJson,
        paymentType,
        timestamp
      ) VALUES (
        $id,
        $currencyType,
        $paymentAmount,
        $paymentDetailJson,
        $paymentType,
        $timestamp
      );
      `
  ).run(forDatabase);
}
