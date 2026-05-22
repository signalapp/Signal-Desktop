// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState, type JSX } from 'react';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { getMuteOptions } from '../../../util/getMuteOptions.std.ts';
import { AxoDialog } from '../../../axo/AxoDialog.dom.tsx';
import { AxoRadioGroup } from '../../../axo/AxoRadioGroup.dom.tsx';
import { safeParseInteger } from '../../../util/numbers.std.ts';
import { strictAssert } from '../../../util/assert.std.ts';

type PropsType = {
  i18n: LocalizerType;
  id: string;
  muteExpiresAt: undefined | number;
  onClose: () => unknown;
  setMuteDuration: (
    conversationId: string,
    muteDuration: undefined | number
  ) => unknown;
};

export function ConversationNotificationsModal({
  i18n,
  id,
  muteExpiresAt,
  onClose,
  setMuteDuration,
}: PropsType): JSX.Element {
  const muteOptions = useMemo(() => {
    return getMuteOptions(muteExpiresAt, i18n).filter(option => {
      return option.value > 0;
    });
  }, [i18n, muteExpiresAt]);

  const [value, setValue] = useState<string>();

  const onConfirm = useCallback(() => {
    if (value == null) {
      return;
    }
    const duration = safeParseInteger(value);
    strictAssert(duration, `Could not parse value: ${value}`);
    setMuteDuration(id, duration);
    onClose();
  }, [id, value, setMuteDuration, onClose]);

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:muteNotificationsTitle')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoRadioGroup.Root value={value ?? null} onValueChange={setValue}>
            {muteOptions.map(option => {
              return (
                <AxoRadioGroup.Item
                  value={`${option.value}`}
                  disabled={option.disabled}
                >
                  <AxoRadioGroup.Indicator />
                  <AxoRadioGroup.Label>{option.name}</AxoRadioGroup.Label>
                </AxoRadioGroup.Item>
              );
            })}
          </AxoRadioGroup.Root>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              onClick={onConfirm}
              disabled={value == null}
            >
              {i18n('icu:mute')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
