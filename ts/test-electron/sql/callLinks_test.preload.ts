// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';

import {
  FAKE_CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY,
} from '../../test-helpers/fakeCallLink.std.js';

const { getCallLinkByRoomId } = DataReader;
const { removeAll, insertCallLink, insertOrUpdateCallLinkFromSync } =
  DataWriter;

describe('sql/insertOrUpdateCallLinkFromSync', () => {
  beforeEach(async () => {
    await removeAll();
  });
  after(async () => {
    await removeAll();
  });

  it('inserts call links', async () => {
    const {
      callLink: resultCallLink,
      inserted,
      updated,
    } = await insertOrUpdateCallLinkFromSync(FAKE_CALL_LINK);

    assert.deepEqual(
      resultCallLink,
      FAKE_CALL_LINK,
      'return value call link should match input'
    );
    assert.equal(inserted, true, 'result.inserted value should be true');
    assert.equal(updated, false, 'result.updated value should be false');

    const dbCallLink = await getCallLinkByRoomId(FAKE_CALL_LINK.roomId);
    assert.deepEqual(
      resultCallLink,
      dbCallLink,
      'database call link should match input'
    );
  });

  it('inserts admin call links', async () => {
    const {
      callLink: resultCallLink,
      inserted,
      updated,
    } = await insertOrUpdateCallLinkFromSync(FAKE_CALL_LINK_WITH_ADMIN_KEY);

    assert.deepEqual(
      resultCallLink,
      FAKE_CALL_LINK_WITH_ADMIN_KEY,
      'return value call link should match input'
    );
    assert.equal(inserted, true, 'result.inserted value should be true');
    assert.equal(updated, false, 'result.updated value should be false');

    const dbCallLink = await getCallLinkByRoomId(
      FAKE_CALL_LINK_WITH_ADMIN_KEY.roomId
    );
    assert.deepEqual(
      resultCallLink,
      dbCallLink,
      'database call link should match input'
    );
  });

  it('updates call links with admin key', async () => {
    await insertCallLink(FAKE_CALL_LINK);

    const newAdminKey = FAKE_CALL_LINK_WITH_ADMIN_KEY.adminKey;
    const callLinkUpdateData = {
      ...FAKE_CALL_LINK,
      adminKey: newAdminKey,
    };
    const {
      callLink: resultCallLink,
      inserted,
      updated,
    } = await insertOrUpdateCallLinkFromSync(callLinkUpdateData);

    assert.deepEqual(
      resultCallLink,
      callLinkUpdateData,
      'return value call link should match input'
    );

    const dbCallLink = await getCallLinkByRoomId(FAKE_CALL_LINK.roomId);
    assert.deepEqual(
      resultCallLink,
      dbCallLink,
      'database call link should match input'
    );

    assert.equal(inserted, false, 'result.inserted value should be false');
    assert.equal(updated, true, 'result.updated value should be true');
  });

  it('no ops when the db is up to date', async () => {
    await insertCallLink(FAKE_CALL_LINK_WITH_ADMIN_KEY);

    const {
      callLink: resultCallLink,
      inserted,
      updated,
    } = await insertOrUpdateCallLinkFromSync(FAKE_CALL_LINK_WITH_ADMIN_KEY);

    assert.deepEqual(
      resultCallLink,
      FAKE_CALL_LINK_WITH_ADMIN_KEY,
      'return value call link should match input'
    );
    assert.equal(inserted, false, 'result.inserted value should be false');
    assert.equal(updated, false, 'result.updated value should be true');

    const dbCallLink = await getCallLinkByRoomId(
      FAKE_CALL_LINK_WITH_ADMIN_KEY.roomId
    );
    assert.deepEqual(
      resultCallLink,
      dbCallLink,
      'database call link should match input'
    );
  });
});
