// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v1 as getGuid } from 'uuid';
import { omit } from 'lodash';

import { DataReader, DataWriter } from '../../sql/Client';

import type { DonationReceipt } from '../../types/Donations';

const { getAllDonationReceipts, getDonationReceiptById } = DataReader;
const {
  _deleteAllDonationReceipts,
  createDonationReceipt,
  deleteDonationReceiptById,
} = DataWriter;

describe('sql/DonationReceipts', () => {
  beforeEach(async () => {
    await _deleteAllDonationReceipts();
  });
  after(async () => {
    await _deleteAllDonationReceipts();
  });

  it('should roundtrip', async () => {
    const now = Date.now();
    const receipt1: DonationReceipt = {
      id: getGuid(),
      currencyType: 'USD',
      paymentAmount: 500, // $5.00
      paymentType: 'CARD',
      paymentDetail: {
        lastFourDigits: '1111',
      },
      timestamp: now,
    };
    const receipt2: DonationReceipt = {
      id: getGuid(),
      currencyType: 'USD',
      paymentAmount: 1000, // $10.00
      paymentType: 'CARD',
      paymentDetail: {
        lastFourDigits: '1111',
      },
      timestamp: now + 10,
    };

    await createDonationReceipt(receipt1);
    const receipt = await getAllDonationReceipts();
    assert.lengthOf(receipt, 1);
    assert.deepEqual(receipt[0], receipt1);

    await createDonationReceipt(receipt2);
    const receipts = await getAllDonationReceipts();
    assert.lengthOf(receipts, 2);
    assert.deepEqual(receipts[0], receipt2);
    assert.deepEqual(receipts[1], receipt1);

    await deleteDonationReceiptById(receipt1.id);
    const backToreceipt = await getAllDonationReceipts();
    assert.lengthOf(backToreceipt, 1);
    assert.deepEqual(backToreceipt[0], receipt2);

    const fetchedMissing = await getDonationReceiptById(receipt1.id);
    assert.isUndefined(fetchedMissing);

    const fetched = await getDonationReceiptById(receipt2.id);
    assert.deepEqual(fetched, receipt2);
  });

  it('clears payment detail if the zod parse fails', async () => {
    const now = Date.now();
    const receipt1: DonationReceipt = {
      id: getGuid(),
      currencyType: 'USD',
      paymentAmount: 500, // $5.00
      paymentType: 'CARD',
      paymentDetail: {
        // @ts-expect-error We are intentionally breaking things here
        lastFourDigits: 1111,
      },
      timestamp: now,
    };

    await createDonationReceipt(receipt1);
    const receipt = await getAllDonationReceipts();
    assert.lengthOf(receipt, 1);
    assert.deepEqual(receipt[0], {
      ...omit(receipt1, 'paymentDetail'),
      paymentDetail: null,
    });
  });
});
