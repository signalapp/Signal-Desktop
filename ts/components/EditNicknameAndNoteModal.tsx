// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import { Avatar, AvatarSize } from './Avatar';
import type {
  ConversationType,
  NicknameAndNote,
} from '../state/ducks/conversations';
import { Input } from './Input';
import { AutoSizeTextArea } from './AutoSizeTextArea';
import { Button, ButtonVariant } from './Button';
import { strictAssert } from '../util/assert';
import { safeParsePartial } from '../util/schemas';

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
    (event: FormEvent) => {
      event.preventDefault();
      if (formResult.success) {
        onSave(formResult.data);
        onClose();
      }
    },
    [formResult, onSave, onClose]
  );

  return (
    <Modal
      modalName="EditNicknameAndNoteModal"
      moduleClassName="EditNicknameAndNoteModal"
      i18n={i18n}
      onClose={onClose}
      title={i18n('icu:EditNicknameAndNoteModal__Title')}
      hasXButton
      modalFooter={
        <>
          <Button variant={ButtonVariant.Secondary} onClick={onClose}>
            {i18n('icu:cancel')}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            type="submit"
            form={formId}
            aria-disabled={!formResult.success}
          >
            {i18n('icu:save')}
          </Button>
        </>
      }
    >
      <p className="EditNicknameAndNoteModal__Description">
        {i18n('icu:EditNicknameAndNoteModal__Description')}
      </p>
      <div className="EditNicknameAndNoteModal__Avatar">
        <Avatar
          {...conversation}
          conversationType={conversation.type}
          i18n={i18n}
          size={AvatarSize.EIGHTY}
          badge={undefined}
          theme={undefined}
        />
      </div>
      <form id={formId} onSubmit={handleSubmit}>
        <label
          htmlFor={givenNameId}
          className="EditNicknameAndNoteModal__Label"
        >
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
        <label
          htmlFor={familyNameId}
          className="EditNicknameAndNoteModal__Label"
        >
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

        <label htmlFor={noteId} className="EditNicknameAndNoteModal__Label">
          {i18n('icu:EditNicknameAndNoteModal__Note__Label')}
        </label>
        <AutoSizeTextArea
          i18n={i18n}
          id={noteId}
          placeholder={i18n('icu:EditNicknameAndNoteModal__Note__Placeholder')}
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
    </Modal>
  );
}
