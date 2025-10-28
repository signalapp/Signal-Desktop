// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import { FileThumbnail } from './FileThumbnail.dom.js';
import { APPLICATION_OCTET_STREAM } from '../types/MIME.std.js';

export default {
  title: 'FileThumbnail',
} satisfies Meta;

export function ThreeLetterExtension(): JSX.Element {
  return (
    <FileThumbnail fileName="a.zip" contentType={APPLICATION_OCTET_STREAM} />
  );
}

export function FourLetterExtension(): JSX.Element {
  return (
    <FileThumbnail fileName="a.abcd" contentType={APPLICATION_OCTET_STREAM} />
  );
}

export function ManyLetterExtension(): JSX.Element {
  return (
    <FileThumbnail
      fileName="a.abcdefgh"
      contentType={APPLICATION_OCTET_STREAM}
    />
  );
}

export function OnlyContentType(): JSX.Element {
  return <FileThumbnail contentType={APPLICATION_OCTET_STREAM} />;
}

export function DangerousExtension(): JSX.Element {
  return (
    <FileThumbnail fileName="a.exe" contentType={APPLICATION_OCTET_STREAM} />
  );
}
