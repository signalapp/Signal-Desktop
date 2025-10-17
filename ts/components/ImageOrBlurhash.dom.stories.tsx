// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './ImageOrBlurhash.dom.js';
import { ImageOrBlurhash } from './ImageOrBlurhash.dom.js';

export default {
  title: 'Components/ImageOrBlurhash',
} satisfies Meta<Props>;

export function JustImage(): JSX.Element {
  return (
    <ImageOrBlurhash
      src="/fixtures/kitten-1-64-64.jpg"
      width={128}
      height={128}
      alt="test"
    />
  );
}

export function JustBlurHash(): JSX.Element {
  return (
    <ImageOrBlurhash
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={128}
      height={128}
      alt="test"
    />
  );
}

export function WideBlurHash(): JSX.Element {
  return (
    <ImageOrBlurhash
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={300}
      height={65}
      alt="test"
    />
  );
}

export function TallBlurHash(): JSX.Element {
  return (
    <ImageOrBlurhash
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={64}
      height={256}
      alt="test"
    />
  );
}

export function FullImage(): JSX.Element {
  return (
    <ImageOrBlurhash
      src="/fixtures/kitten-1-64-64.jpg"
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={128}
      height={128}
      alt="test"
    />
  );
}
