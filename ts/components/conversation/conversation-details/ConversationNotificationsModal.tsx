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
  muteExpiresAt: undefined | number;
  onClose: () => unknown;
  setMuteExpiration: (muteExpiresAt: undefined | number) => unknown;
};

export const ConversationNotificationsModal = ({
  i18n,
  muteExpiresAt,
  onClose,
  setMuteExpiration,
}: PropsType): JSX.Element => {
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
    setMuteExpiration(ms);
    onClose();
  };

  return (
    <Modal
      hasStickyButtons
      hasXButton
      onClose={onClose}
      i18n={i18n}
      title={i18n('muteNotificationsTitle')}
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
      <Modal.ButtonFooter>
        <Button onClick={onClose} variant={ButtonVariant.Secondary}>
          {i18n('cancel')}
        </Button>
        <Button onClick={onMuteChange} variant={ButtonVariant.Primary}>
          {i18n('mute')}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
};
