// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState, type JSX } from 'react';
import { v4 as uuid } from 'uuid';

import type { LocalizerType } from '../../../types/Util.std.ts';
import { getMuteOptions } from '../../../util/getMuteOptions.std.ts';
import { parseIntOrThrow } from '../../../util/parseIntOrThrow.std.ts';
import { CircleCheckbox, Variant } from '../../CircleCheckbox.dom.tsx';
import { Modal } from '../../Modal.dom.tsx';
import { Button, ButtonVariant } from '../../Button.dom.tsx';

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
  const muteOptions = useMemo(
    () =>
      getMuteOptions(muteExpiresAt, i18n)
        .map(({ disabled, name, value }) => ({
          disabled,
          text: name,
          value,
        }))
        .filter(x => x.value > 0),
    [i18n, muteExpiresAt]
  );

  const [muteDurationValue, setMuteDurationValue] = useState<number>();

  const onMuteChange = () => {
    const ms = parseIntOrThrow(
      muteDurationValue,
      'NotificationSettings: mute ms was not an integer'
    );
    setMuteDuration(id, ms);
    onClose();
  };

  const htmlIds = useMemo(() => {
    return Array.from({ length: muteOptions.length }, () => uuid());
  }, [muteOptions.length]);

  return (
    <Modal
      modalName="ConversationNotificationsModal"
      hasXButton
      onClose={onClose}
      i18n={i18n}
      title={i18n('icu:muteNotificationsTitle')}
      modalFooter={
        <>
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('icu:cancel')}
          </Button>
          <Button onClick={onMuteChange} variant={ButtonVariant.Primary}>
            {i18n('icu:mute')}
          </Button>
        </>
      }
    >
      {muteOptions.map((option, i) => (
        <label
          className="Preferences__settings-radio__label"
          // oxlint-disable-next-line react/no-array-index-key
          key={htmlIds[i]}
          htmlFor={htmlIds[i]}
        >
          <CircleCheckbox
            id={htmlIds[i]}
            checked={muteDurationValue === option.value}
            variant={Variant.Small}
            disabled={option.disabled}
            isRadio
            moduleClassName="ConversationDetails__radio"
            name="mute"
            onChange={value => value && setMuteDurationValue(option.value)}
          />
          {option.text}
        </label>
      ))}
    </Modal>
  );
}
