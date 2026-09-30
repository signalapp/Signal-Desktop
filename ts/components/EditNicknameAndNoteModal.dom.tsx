// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type { LocalizerType } from '../types/I18N.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import type {
  ConversationType,
  NicknameAndNote,
} from '../state/ducks/conversations.preload.ts';
import { strictAssert } from '../util/assert.std.ts';
import { safeParsePartial } from '../util/schemas.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoFieldList } from '../axo/items/AxoFieldList.dom.tsx';
import { AxoTextField } from '../axo/fields/AxoTextField.dom.tsx';

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

  const initialGivenName = conversation.nicknameGivenName ?? '';
  const initialFamilyName = conversation.nicknameFamilyName ?? '';
  const initialNote = conversation.note ?? '';

  const [givenName, setGivenName] = useState(initialGivenName);
  const [familyName, setFamilyName] = useState(initialFamilyName);
  const [note, setNote] = useState(initialNote);

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

  const submitDisabled = useMemo(() => {
    if (!formResult.success) {
      return true; // invalid
    }

    const { data } = formResult;
    const updatedGivenName = data.nickname?.givenName ?? '';
    const updatedFamilyName = data.nickname?.familyName ?? '';
    const updatedNote = data.note ?? '';

    const hasChanged =
      updatedGivenName !== initialGivenName ||
      updatedFamilyName !== initialFamilyName ||
      updatedNote !== initialNote;

    return !hasChanged;
  }, [formResult, initialGivenName, initialFamilyName, initialNote]);

  const handleSubmit = useCallback(() => {
    if (submitDisabled) {
      return;
    }

    if (formResult.success) {
      onSave(formResult.data);
      onClose();
    }
  }, [submitDisabled, formResult, onSave, onClose]);

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
        <AxoDialog.Body padding="sm">
          <AxoDialog.Description>
            <p
              className={tw(
                'mb-3 text-center type-body-small text-pretty text-secondary'
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
          <form ref={formRef} id={formId} action={handleSubmit}>
            <AxoList.Group>
              <AxoFieldList.Root>
                <AxoFieldList.Item>
                  <label htmlFor={givenNameId} className={tw('sr-only')}>
                    {i18n('icu:EditNicknameAndNoteModal__FirstName__Label')}
                  </label>

                  <AxoTextField.Root
                    id={givenNameId}
                    value={givenName}
                    onValueChange={setGivenName}
                    maxGraphemes={26}
                    maxBytes={128}
                  >
                    <AxoTextField.Input
                      placeholder={i18n(
                        'icu:EditNicknameAndNoteModal__FirstName__Placeholder'
                      )}
                    />
                    <AxoTextField.Count />
                  </AxoTextField.Root>
                </AxoFieldList.Item>

                <AxoFieldList.Item>
                  <label htmlFor={familyNameId} className={tw('sr-only')}>
                    {i18n('icu:EditNicknameAndNoteModal__LastName__Label')}
                  </label>
                  <AxoTextField.Root
                    id={familyNameId}
                    value={familyName}
                    onValueChange={setFamilyName}
                    maxGraphemes={26}
                    maxBytes={128}
                  >
                    <AxoTextField.Input
                      placeholder={i18n(
                        'icu:EditNicknameAndNoteModal__LastName__Placeholder'
                      )}
                    />
                    <AxoTextField.Count />
                  </AxoTextField.Root>
                </AxoFieldList.Item>

                <AxoFieldList.Item>
                  <label htmlFor={noteId} className={tw('sr-only')}>
                    {i18n('icu:EditNicknameAndNoteModal__Note__Label')}
                  </label>

                  <AxoTextField.Root
                    id={noteId}
                    value={note}
                    onValueChange={setNote}
                    maxGraphemes={240}
                    maxBytes={240}
                  >
                    <AxoTextField.TextArea
                      minLines={2}
                      maxLines={5}
                      placeholder={i18n(
                        'icu:EditNicknameAndNoteModal__Note__Placeholder'
                      )}
                    />
                    <AxoTextField.Count />
                  </AxoTextField.Root>
                </AxoFieldList.Item>
              </AxoFieldList.Root>
            </AxoList.Group>

            {/* This is used so the Enter key submits the form. */}
            {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label */}
            <button type="submit" hidden disabled={submitDisabled} />
          </form>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="strong-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={requestSubmit}
              disabled={submitDisabled}
            >
              {i18n('icu:save')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
