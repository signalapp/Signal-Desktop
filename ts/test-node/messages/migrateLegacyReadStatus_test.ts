// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We want to cast to `any` because we're passing an unexpected field.
/* eslint-disable @typescript-eslint/no-explicit-any */

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
      migrateLegacyReadStatus({ unread: 0 } as any),
      ReadStatus.Read
    );
    assert.strictEqual(
      migrateLegacyReadStatus({ unread: false } as any),
      ReadStatus.Read
    );
  });

  it('converts legacy unread values to "unread"', () => {
    assert.strictEqual(
      migrateLegacyReadStatus({ unread: 1 } as any),
      ReadStatus.Unread
    );
    assert.strictEqual(
      migrateLegacyReadStatus({ unread: true } as any),
      ReadStatus.Unread
    );
  });

  it('converts unexpected truthy values to "unread"', () => {
    assert.strictEqual(
      migrateLegacyReadStatus({ unread: 99 } as any),
      ReadStatus.Unread
    );
    assert.strictEqual(
      migrateLegacyReadStatus({ unread: 'wow!' } as any),
      ReadStatus.Unread
    );
  });
});
