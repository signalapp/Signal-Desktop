// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { ChatStyle } from '../types/ChatStyle.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import {
  createCustomColorEditorState,
  CustomColorEditor,
  serializeCustomColorEditorState,
  type CustomColorEditorMode,
  type CustomColorEditorState,
} from './CustomColorEditor.dom.tsx';

export type CustomColorEditorDialogProps = Readonly<{
  i18n: LocalizerType;
  initialColor: ChatStyle.CustomChatColor['color'] | null;
  onClose: () => void;
  onSave: (color: ChatStyle.CustomChatColor['color']) => void;
}>;

export function CustomColorEditorDialog(
  props: CustomColorEditorDialogProps
): ReactNode {
  const { i18n, initialColor, onClose, onSave } = props;

  const [editorState, setEditorState] = useState((): CustomColorEditorState => {
    return createCustomColorEditorState(initialColor);
  });

  const [mode, setMode] = useState((): CustomColorEditorMode => {
    return initialColor?.gradient != null ? 'gradient' : 'solid';
  });

  const handleTabChange = useCallback((value: string) => {
    setMode(value as CustomColorEditorMode);
  }, []);

  const handleSave = useCallback(() => {
    onSave(serializeCustomColorEditorState(mode, editorState));
    onClose();
  }, [onSave, onClose, mode, editorState]);

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content
        size="md"
        escape="cancel-is-destructive"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:CustomColorEditor__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Tabs value={mode} onValueChange={handleTabChange}>
          <AxoDialog.TabList>
            <AxoDialog.Tab value="solid">
              {i18n('icu:CustomColorEditor__solid')}
            </AxoDialog.Tab>
            <AxoDialog.Tab value="gradient">
              {i18n('icu:CustomColorEditor__gradient')}
            </AxoDialog.Tab>
          </AxoDialog.TabList>
          <AxoDialog.TabContent value="solid">
            <AxoDialog.Body padding="md">
              <CustomColorEditor
                i18n={i18n}
                mode="solid"
                editorState={editorState}
                onEditorStateChange={setEditorState}
              />
            </AxoDialog.Body>
          </AxoDialog.TabContent>
          <AxoDialog.TabContent value="gradient">
            <AxoDialog.Body padding="md">
              <CustomColorEditor
                i18n={i18n}
                mode="gradient"
                editorState={editorState}
                onEditorStateChange={setEditorState}
              />
            </AxoDialog.Body>
          </AxoDialog.TabContent>
        </AxoDialog.Tabs>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="strong-primary" onClick={handleSave}>
              {i18n('icu:save')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
