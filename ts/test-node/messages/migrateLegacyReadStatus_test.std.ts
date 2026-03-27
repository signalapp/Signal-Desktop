// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';

import { migrateLegacyReadStatus } from '../../messages/migrateLegacyReadStatus.std.js';

describe('migrateLegacyReadStatus', () => {
  it("doesn't migrate messages that already have the modern read state", () => {
    assert.isUndefined(
      migrateLegacyReadStatus({ readStatus: ReadStatus.Read })
    );
    assert.isUndefined(
      migrateLegacyReadStatus({ readStatus: ReadStatus.Unread })
    );
  });

  it('converts legacy read values to "read"', () => {
    assert.strictEqual(migrateLegacyReadStatus({}), ReadStatus.Read);
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: 0 } as any),
      ReadStatus.Read
    );
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: false } as any),
      ReadStatus.Read
    );
  });

  it('converts legacy unread values to "unread"', () => {
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: 1 } as any),
      ReadStatus.Unread
    );
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: true } as any),
      ReadStatus.Unread
    );
  });

  it('converts unexpected truthy values to "unread"', () => {
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: 99 } as any),
      ReadStatus.Unread
    );
    assert.strictEqual(
      // oxlint-disable-next-line typescript/no-explicit-any
      migrateLegacyReadStatus({ unread: 'wow!' } as any),
      ReadStatus.Unread
    );
  });
});
