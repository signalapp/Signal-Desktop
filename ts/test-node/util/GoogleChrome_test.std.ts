// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  isVideoTypeSupported,
  getSupportedVideoTypes,
} from '../../util/GoogleChrome.std.ts';
import { stringToMIMEType } from '../../types/MIME.std.ts';

describe('GoogleChrome video MIME support', () => {
  it('supports mp4, ogg, webm, and quicktime for inline playback', () => {
    assert.isTrue(isVideoTypeSupported(stringToMIMEType('video/mp4')));
    assert.isTrue(isVideoTypeSupported(stringToMIMEType('video/ogg')));
    assert.isTrue(isVideoTypeSupported(stringToMIMEType('video/webm')));
    assert.isTrue(isVideoTypeSupported(stringToMIMEType('video/quicktime')));
  });

  it('does not treat arbitrary video containers as supported', () => {
    assert.isFalse(isVideoTypeSupported(stringToMIMEType('video/x-ms-wmv')));
    assert.isFalse(isVideoTypeSupported(stringToMIMEType('video/avi')));
  });

  it('includes quicktime in getSupportedVideoTypes', () => {
    assert.include(
      getSupportedVideoTypes(),
      stringToMIMEType('video/quicktime')
    );
  });
});
