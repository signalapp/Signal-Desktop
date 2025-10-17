// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState, useId } from 'react';
import type { Meta } from '@storybook/react';
import { VisuallyHidden } from 'react-aria';
import { FunGif, FunGifPreview } from './FunGif.dom.js';
import { LoadingState } from '../../util/loadable.std.js';

export default {
  title: 'Components/Fun/FunGif',
} satisfies Meta;

export function Basic(): JSX.Element {
  const id = useId();
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0}>
        <FunGif
          src="https://media.tenor.com/tN6E5iSxeI8AAAPo/spongebob-spongebob-squarepants.mp4"
          width={498}
          height={376}
          aria-label="Spongebob Spongebob Squarepants GIF"
          aria-describedby={id}
        />
      </div>
      <VisuallyHidden id={id}>
        A cartoon of spongebob wearing a top hat is laying on the ground
      </VisuallyHidden>
    </>
  );
}

export function PreviewSizing(): JSX.Element {
  return (
    <>
      <FunGifPreview
        src="https://media.tenor.com/tN6E5iSxeI8AAAPo/spongebob-spongebob-squarepants.mp4"
        state={LoadingState.Loaded}
        width={498}
        height={376}
        maxHeight={400}
        aria-describedby=""
      />
      <div style={{ maxWidth: 200 }}>
        <FunGifPreview
          src="https://media.tenor.com/tN6E5iSxeI8AAAPo/spongebob-spongebob-squarepants.mp4"
          state={LoadingState.Loaded}
          width={498}
          height={376}
          maxHeight={400}
          aria-describedby=""
        />
      </div>
      <div style={{ maxHeight: 200 }}>
        <FunGifPreview
          src="https://media.tenor.com/tN6E5iSxeI8AAAPo/spongebob-spongebob-squarepants.mp4"
          state={LoadingState.Loaded}
          width={498}
          height={376}
          maxHeight={200}
          aria-describedby=""
        />
      </div>
    </>
  );
}

export function PreviewLoading(): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setSrc(
        'https://media.tenor.com/tN6E5iSxeI8AAAPo/spongebob-spongebob-squarepants.mp4'
      );
    }, 2000);
  }, []);

  return (
    <FunGifPreview
      src={src}
      state={src == null ? LoadingState.Loading : LoadingState.Loaded}
      width={498}
      height={376}
      maxHeight={400}
      aria-describedby=""
    />
  );
}

export function PreviewError(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setError(new Error('yikes!'));
    }, 2000);
  }, []);

  return (
    <FunGifPreview
      src={null}
      state={error == null ? LoadingState.Loading : LoadingState.LoadFailed}
      width={498}
      height={376}
      maxHeight={400}
      aria-describedby=""
    />
  );
}
