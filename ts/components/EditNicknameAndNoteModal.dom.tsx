// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX, SubmitEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type { LocalizerType } from '../types/I18N.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import type {
  ConversationType,
  NicknameAndNote,
} from '../state/ducks/conversations.preload.ts';
import { Input } from './Input.dom.tsx';
import { AutoSizeTextArea } from './AutoSizeTextArea.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { safeParsePartial } from '../util/schemas.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

const formSchema = z.object({
  nickname: z
    .object({
      givenName: z.string().nullable(),
      familyName: z.string().nullable(),
    })
    .nullable(),
  note: z.string().nullable(),
});

function toOptionalStringValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type EditNicknameAndNoteModalProps = Readonly<{
  conversation: ConversationType;
  i18n: LocalizerType;
  onSave: (result: NicknameAndNote) => void;
  onClose: () => void;
}>;

export function EditNicknameAndNoteModal({
  conversation,
  i18n,
  onSave,
  onClose,
}: EditNicknameAndNoteModalProps): JSX.Element {
  strictAssert(
    conversation.type === 'direct',
    'Expected a direct conversation'
  );

  const formRef = useRef<HTMLFormElement>(null);

  const [givenName, setGivenName] = useState(
    conversation.nicknameGivenName ?? ''
  );
  const [familyName, setFamilyName] = useState(
    conversation.nicknameFamilyName ?? ''
  );
  const [note, setNote] = useState(conversation.note ?? '');

  const [formId] = useState(() => uuid());
  const [givenNameId] = useState(() => uuid());
  const [familyNameId] = useState(() => uuid());
  const [noteId] = useState(() => uuid());

  const formResult = useMemo(() => {
    const givenNameValue = toOptionalStringValue(givenName);
    const familyNameValue = toOptionalStringValue(familyName);
    const noteValue = toOptionalStringValue(note);
    const hasEitherName = givenNameValue != null || familyNameValue != null;
    return safeParsePartial(formSchema, {
      nickname: hasEitherName
        ? { givenName: givenNameValue, familyName: familyNameValue }
        : null,
      note: noteValue,
    });
  }, [givenName, familyName, note]);

  const handleSubmit = useCallback(
    (event: SubmitEvent) => {
      event.preventDefault();
      if (formResult.success) {
        onSave(formResult.data);
        onClose();
      }
    },
    [formResult, onSave, onClose]
  );

  const requestSubmit = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:EditNicknameAndNoteModal__Title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p
              className={tw(
                'mb-3 text-center type-body-small text-pretty text-label-secondary'
              )}
            >
              {i18n('icu:EditNicknameAndNoteModal__Description')}
            </p>
          </AxoDialog.Description>
          <div className={tw('mb-6 flex justify-center')}>
            <Avatar
              {...conversation}
              conversationType={conversation.type}
              i18n={i18n}
              size={AvatarSize.EIGHTY}
              badge={undefined}
              theme={undefined}
            />
          </div>
          <form ref={formRef} id={formId} onSubmit={handleSubmit}>
            <label htmlFor={givenNameId} className={tw('sr-only')}>
              {i18n('icu:EditNicknameAndNoteModal__FirstName__Label')}
            </label>
            <Input
              id={givenNameId}
              i18n={i18n}
              placeholder={i18n(
                'icu:EditNicknameAndNoteModal__FirstName__Placeholder'
              )}
              value={givenName}
              hasClearButton
              maxLengthCount={26}
              maxByteCount={128}
              onChange={value => {
                setGivenName(value);
              }}
            />
            <label htmlFor={familyNameId} className={tw('sr-only')}>
              {i18n('icu:EditNicknameAndNoteModal__LastName__Label')}
            </label>
            <Input
              id={familyNameId}
              i18n={i18n}
              placeholder={i18n(
                'icu:EditNicknameAndNoteModal__LastName__Placeholder'
              )}
              value={familyName}
              hasClearButton
              maxLengthCount={26}
              maxByteCount={128}
              onChange={value => {
                setFamilyName(value);
              }}
            />

            <label htmlFor={noteId} className={tw('sr-only')}>
              {i18n('icu:EditNicknameAndNoteModal__Note__Label')}
            </label>
            <AutoSizeTextArea
              i18n={i18n}
              id={noteId}
              placeholder={i18n(
                'icu:EditNicknameAndNoteModal__Note__Placeholder'
              )}
              value={note}
              maxByteCount={240}
              maxLengthCount={240}
              whenToShowRemainingCount={140}
              whenToWarnRemainingCount={235}
              onChange={value => {
                setNote(value);
              }}
            />
            <button type="submit" hidden>
              {i18n('icu:submit')}
            </button>
          </form>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              onClick={requestSubmit}
              disabled={!formResult.success}
            >
              {i18n('icu:save')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
