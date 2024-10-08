// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import type { LocalizerType } from '../../../types/Util';
import { getMuteOptions } from '../../../util/getMuteOptions';
import { parseIntOrThrow } from '../../../util/parseIntOrThrow';
import { CircleCheckbox, Variant } from '../../CircleCheckbox';
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
      getMuteOptions(muteExpiresAt, i18n)
        .map(({ disabled, name, value }) => ({
          disabled,
          text: name,
          value,
        }))
        .filter(x => x.value > 0),
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
          key={htmlIds[i]}
          htmlFor={htmlIds[i]}
        >
          <CircleCheckbox
            id={htmlIds[i]}
            checked={muteExpirationValue === option.value}
            variant={Variant.Small}
            disabled={option.disabled}
            isRadio
            moduleClassName="ConversationDetails__radio"
            name="mute"
            onChange={value => value && setMuteExpirationValue(option.value)}
          />
          {option.text}
        </label>
      ))}
    </Modal>
  );
}
