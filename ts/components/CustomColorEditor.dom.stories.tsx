// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { useState } from 'react';
import type { Meta } from '@storybook/react';
import type { CustomColorEditorProps } from './CustomColorEditor.dom.tsx';
import {
  createCustomColorEditorState,
  CustomColorEditor,
  INITIAL_CUSTOM_CHAT_COLOR,
} from './CustomColorEditor.dom.tsx';

export default {
  title: 'Components/CustomColorEditor',
} satisfies Meta<CustomColorEditorProps>;

const { i18n } = window.SignalContext;

export function Solid(): JSX.Element {
  const [editorState, setEditorState] = useState(() => {
    return createCustomColorEditorState(INITIAL_CUSTOM_CHAT_COLOR);
  });
  return (
    <CustomColorEditor
      mode="solid"
      i18n={i18n}
      editorState={editorState}
      onEditorStateChange={setEditorState}
    />
  );
}

export function Gradient(): JSX.Element {
  const [editorState, setEditorState] = useState(() => {
    return createCustomColorEditorState(INITIAL_CUSTOM_CHAT_COLOR);
  });
  return (
    <CustomColorEditor
      mode="gradient"
      i18n={i18n}
      editorState={editorState}
      onEditorStateChange={setEditorState}
    />
  );
}
