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

const MOCK_GIF_URL =
  'https://media2.giphy.com/media/v1.Y2lkPTZhNGNmY2JhaXFlbXZxcHVjNXlmaGdlYWs1dTlwYnNrb2I5aGttbXViYjh4Z2hqbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3kzJvEciJa94SMW3hN/giphy.mp4';
const MOCK_GIF_WIDTH = 480;
const MOCK_GIF_HEIGHT = 418;

export function Basic(): React.JSX.Element {
  const id = useId();
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0}>
        <FunGif
          src={MOCK_GIF_URL}
          width={MOCK_GIF_WIDTH}
          height={MOCK_GIF_HEIGHT}
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

export function PreviewSizing(): React.JSX.Element {
  return (
    <>
      <FunGifPreview
        src={MOCK_GIF_URL}
        state={LoadingState.Loaded}
        width={MOCK_GIF_WIDTH}
        height={MOCK_GIF_HEIGHT}
        maxHeight={400}
        aria-describedby=""
      />
      <div style={{ maxWidth: 200 }}>
        <FunGifPreview
          src={MOCK_GIF_URL}
          state={LoadingState.Loaded}
          width={MOCK_GIF_WIDTH}
          height={MOCK_GIF_HEIGHT}
          maxHeight={400}
          aria-describedby=""
        />
      </div>
      <div style={{ maxHeight: 200 }}>
        <FunGifPreview
          src={MOCK_GIF_URL}
          state={LoadingState.Loaded}
          width={MOCK_GIF_WIDTH}
          height={MOCK_GIF_HEIGHT}
          maxHeight={200}
          aria-describedby=""
        />
      </div>
    </>
  );
}

export function PreviewLoading(): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setSrc(MOCK_GIF_URL);
    }, 2000);
  }, []);

  return (
    <FunGifPreview
      src={src}
      state={src == null ? LoadingState.Loading : LoadingState.Loaded}
      width={MOCK_GIF_WIDTH}
      height={MOCK_GIF_HEIGHT}
      maxHeight={400}
      aria-describedby=""
    />
  );
}

export function PreviewError(): React.JSX.Element {
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
      width={MOCK_GIF_WIDTH}
      height={MOCK_GIF_HEIGHT}
      maxHeight={400}
      aria-describedby=""
    />
  );
}
