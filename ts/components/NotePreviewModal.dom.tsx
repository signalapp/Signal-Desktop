// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/I18N.std.ts';
import { Linkify } from './conversation/Linkify.dom.tsx';
import type { RenderTextCallbackType } from '../types/Util.std.ts';
import { Emojify } from './conversation/Emojify.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

export type NotePreviewModalProps = Readonly<{
  conversation: ConversationType;
  i18n: LocalizerType;
  onClose: () => void;
  onEdit: () => void;
}>;

const renderNonLink: RenderTextCallbackType = ({ key, text }) => {
  return <Emojify key={key} text={text} />;
};

export function NotePreviewModal(props: NotePreviewModalProps): ReactNode {
  const { i18n } = props;
  return (
    <AxoDialog.Root open onOpenChange={props.onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:NotePreviewModal__Title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p dir="auto">
              <Linkify
                text={props.conversation.note ?? ''}
                renderNonLink={renderNonLink}
              />
            </p>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={props.onEdit}>
              {i18n('icu:edit')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-primary" onClick={props.onClose}>
              {i18n('icu:done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
