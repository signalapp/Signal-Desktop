// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { debounce, dropRight } from 'lodash';
import { text as textKnob } from '@storybook/addon-knobs';

import { StoryRow } from '../elements/StoryRow';
import { Toaster } from './Toaster';

export default {
  title: 'Sticker Creator/components',
};

export const _Toaster = (): JSX.Element => {
  const inputText = textKnob('Slices', ['error 1', 'error 2'].join('|'));
  const initialState = React.useMemo(() => inputText.split('|'), [inputText]);
  const [state, setState] = React.useState(initialState);

  // TODO not sure how to fix this
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDismiss = React.useCallback(
    // Debounce is required here since auto-dismiss is asynchronously called
    // from multiple rendered instances (multiple themes)
    debounce(() => {
      setState(dropRight);
    }, 10),
    [setState]
  );

  return (
    <StoryRow>
      <Toaster
        loaf={state.map((text, id) => ({ id, text }))}
        onDismiss={handleDismiss}
      />
    </StoryRow>
  );
};
