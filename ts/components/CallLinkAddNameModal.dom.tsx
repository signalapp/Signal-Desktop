// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, useState, type JSX } from 'react';
import { v4 as generateUuid } from 'uuid';
import type { LocalizerType } from '../types/I18N.std.ts';
import {
  CallLinkNameMaxByteLength,
  CallLinkNameMaxLength,
  type CallLinkType,
} from '../types/CallLink.std.ts';
import { getColorForCallLink } from '../util/getColorForCallLink.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoFieldList } from '../axo/items/AxoFieldList.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoTextField } from '../axo/fields/AxoTextField.dom.tsx';
import { AxoAvatar } from '../axo/AxoAvatar.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type CallLinkAddNameModalProps = Readonly<{
  i18n: LocalizerType;
  callLink: CallLinkType;
  onClose: () => void;
  onUpdateCallLinkName: (name: string) => void;
}>;

export function CallLinkAddNameModal({
  i18n,
  callLink,
  onClose,
  onUpdateCallLinkName,
}: CallLinkAddNameModalProps): JSX.Element {
  const [formId] = useState(() => generateUuid());
  const [nameId] = useState(() => generateUuid());
  const [nameInput, setNameInput] = useState(callLink.name);

  const parsedForm = useMemo(() => {
    const name = nameInput.trim();
    if (name === callLink.name) {
      return null;
    }
    return { name };
  }, [nameInput, callLink]);

  const handleSubmit = useCallback(() => {
    if (parsedForm == null) {
      return;
    }
    onUpdateCallLinkName(parsedForm.name);
    onClose();
  }, [parsedForm, onUpdateCallLinkName, onClose]);

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {callLink.name === ''
              ? i18n('icu:CallLinkAddNameModal__Title')
              : i18n('icu:CallLinkAddNameModal__Title--Edit')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <form id={formId} action={handleSubmit}>
            <div className={tw('mb-3 flex flex-col items-center')}>
              <AxoAvatar.Root size={64}>
                <AxoAvatar.Icon
                  symbol="videocamera"
                  color={getColorForCallLink(callLink.rootKey)}
                />
              </AxoAvatar.Root>
            </div>

            <AxoList.Group>
              <AxoFieldList.Root>
                <AxoFieldList.Item>
                  <label htmlFor={nameId} className={tw('sr-only')}>
                    {i18n('icu:CallLinkAddNameModal__NameLabel')}
                  </label>
                  <AxoTextField.Root
                    id={nameId}
                    value={nameInput}
                    onValueChange={setNameInput}
                    maxBytes={CallLinkNameMaxByteLength}
                    maxGraphemes={CallLinkNameMaxLength}
                  >
                    <AxoTextField.Input
                      autoFocus
                      placeholder={i18n('icu:CallLinkAddNameModal__NameLabel')}
                    />
                  </AxoTextField.Root>
                </AxoFieldList.Item>
              </AxoFieldList.Root>
            </AxoList.Group>
          </form>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={handleSubmit}
              disabled={parsedForm == null}
            >
              {i18n('icu:save')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
