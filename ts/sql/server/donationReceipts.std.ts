// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from '../util.std.js';

import type { DonationReceipt } from '../../types/Donations.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';

export function getAllDonationReceipts(db: ReadableDB): Array<DonationReceipt> {
  const donationReceipts = db
    .prepare('SELECT * FROM donationReceipts ORDER BY timestamp DESC;')
    .all<DonationReceipt>();

  return donationReceipts;
}
export function getDonationReceiptById(
  db: ReadableDB,
  id: string
): DonationReceipt | undefined {
  const [query, parameters] =
    sql`SELECT * FROM donationReceipts WHERE id = ${id}`;
  return db.prepare(query).get<DonationReceipt>(parameters);
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
  db.prepare(
    `
      INSERT INTO donationReceipts(
        id,
        currencyType,
        paymentAmount,
        timestamp
      ) VALUES (
        $id,
        $currencyType,
        $paymentAmount,
        $timestamp
      );
      `
  ).run(receipt);
}
