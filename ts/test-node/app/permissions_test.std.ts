// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WebContents } from 'electron';

import { _createPermissionHandler } from '../../../app/permissions.std.ts';

type HandlerParams = Parameters<
  NonNullable<ReturnType<typeof _createPermissionHandler>>
>;

describe('permissions', () => {
  function request(
    permission: HandlerParams[1],
    details: object,
    config: Record<string, unknown> = {}
  ): boolean {
    const handler = _createPermissionHandler({ get: key => config[key] });
    assert.isNotNull(handler);

    let result: boolean | undefined;
    handler(
      {} as WebContents,
      permission,
      value => {
        result = value;
      },
      details as HandlerParams[3]
    );

    assert.isDefined(result);
    return result;
  }

  describe('media', () => {
    it('allows microphone only when enabled', () => {
      const details = { mediaTypes: ['audio'] };
      assert.isFalse(request('media', details));
      assert.isFalse(
        request('media', details, { mediaCameraPermissions: true })
      );
      assert.isTrue(request('media', details, { mediaPermissions: true }));
    });

    it('allows camera only when enabled', () => {
      const details = { mediaTypes: ['video'] };
      assert.isFalse(request('media', details));
      assert.isFalse(request('media', details, { mediaPermissions: true }));
      assert.isTrue(
        request('media', details, { mediaCameraPermissions: true })
      );
    });

    it('requires both settings for microphone and camera', () => {
      const details = { mediaTypes: ['audio', 'video'] };
      assert.isFalse(request('media', details, { mediaPermissions: true }));
      assert.isFalse(
        request('media', details, { mediaCameraPermissions: true })
      );
      assert.isTrue(
        request('media', details, {
          mediaPermissions: true,
          mediaCameraPermissions: true,
        })
      );
    });

    it('denies requests without media types', () => {
      assert.isFalse(request('media', {}));
      assert.isFalse(
        request(
          'media',
          { mediaTypes: [] },
          { mediaPermissions: true, mediaCameraPermissions: true }
        )
      );
    });
  });

  it('allows display-capture', () => {
    assert.isTrue(request('display-capture', { mediaTypes: ['video'] }));
  });

  it('denies unlisted permissions', () => {
    assert.isFalse(request('geolocation', {}));
  });
});
