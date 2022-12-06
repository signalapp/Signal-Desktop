// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useState } from 'react';

import type { LocalizerType } from '../../../types/Util';
import { getMuteOptions } from '../../../util/getMuteOptions';
import { parseIntOrThrow } from '../../../util/parseIntOrThrow';
import { Checkbox } from '../../Checkbox';
import { Modal } from '../../Modal';
import { Button, ButtonVariant } from '../../Button';

type PropsType = {
  i18n: LocalizerType;
  id: string;
  muteExpiresAt: undefined | number;
  onClose: () => unknown;
  setMuteExpiration: (
    conversationId: string,
    muteExpiresAt: undefined | number
  ) => unknown;
};

export function ConversationNotificationsModal({
  i18n,
  id,
  muteExpiresAt,
  onClose,
  setMuteExpiration,
}: PropsType): JSX.Element {
  const muteOptions = useMemo(
    () =>
      getMuteOptions(muteExpiresAt, i18n).map(({ disabled, name, value }) => ({
        disabled,
        text: name,
        value,
      })),
    [i18n, muteExpiresAt]
  );

  const [muteExpirationValue, setMuteExpirationValue] = useState(muteExpiresAt);

  const onMuteChange = () => {
    const ms = parseIntOrThrow(
      muteExpirationValue,
      'NotificationSettings: mute ms was not an integer'
    );
    setMuteExpiration(id, ms);
    onClose();
  };

  return (
    <Modal
      modalName="ConversationNotificationsModal"
      hasXButton
      onClose={onClose}
      i18n={i18n}
      title={i18n('muteNotificationsTitle')}
      modalFooter={
        <>
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('cancel')}
          </Button>
          <Button onClick={onMuteChange} variant={ButtonVariant.Primary}>
            {i18n('mute')}
          </Button>
        </>
      }
    >
      {muteOptions
        .filter(x => x.value > 0)
        .map(option => (
          <Checkbox
            checked={muteExpirationValue === option.value}
            disabled={option.disabled}
            isRadio
            key={option.value}
            label={option.text}
            moduleClassName="ConversationDetails__radio"
            name="mute"
            onChange={value => value && setMuteExpirationValue(option.value)}
          />
        ))}
    </Modal>
  );
}
