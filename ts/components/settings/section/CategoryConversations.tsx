import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { ToastUtils } from '../../../session/utils';
import { toggleAudioAutoplay } from '../../../state/ducks/userConfig';
import { getAudioAutoplay } from '../../../state/selectors/userConfig';
import { SessionRadioGroup } from '../../basic/SessionRadioGroup';
import { BlockedContactsList } from '../BlockedList';
import {
  SessionSettingsItemWrapper,
  SessionToggleWithDescription,
} from '../SessionSettingListItem';
import { useHasEnterSendEnabled } from '../../../state/selectors/settings';

async function toggleCommunitiesPruning() {
  try {
    const newValue = !(await window.getOpengroupPruning());

    // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
    await window.setSettingValue(SettingsKey.settingsOpengroupPruning, newValue);
    await window.setOpengroupPruning(newValue);
    ToastUtils.pushRestartNeeded();
  } catch (e) {
    window.log.warn('toggleCommunitiesPruning change error:', e);
  }
}

const CommunitiesPruningSetting = () => {
  const forceUpdate = useUpdate();
  const isOpengroupPruningEnabled = Boolean(
    window.getSettingValue(SettingsKey.settingsOpengroupPruning)
  );
  return (
    <SessionToggleWithDescription
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClickToggle={async () => {
        await toggleCommunitiesPruning();
        forceUpdate();
      }}
      title={window.i18n('pruneSettingTitle')}
      description={window.i18n('pruneSettingDescription')}
      active={isOpengroupPruningEnabled}
    />
  );
};

const SpellCheckSetting = () => {
  const forceUpdate = useUpdate();

  const isSpellCheckActive =
    window.getSettingValue(SettingsKey.settingsSpellCheck) === undefined
      ? true
      : window.getSettingValue(SettingsKey.settingsSpellCheck);
  return (
    <SessionToggleWithDescription
      onClickToggle={() => {
        window.toggleSpellCheck();
        forceUpdate();
      }}
      title={window.i18n('spellCheckTitle')}
      description={window.i18n('spellCheckDescription')}
      active={isSpellCheckActive}
    />
  );
};

const AudioMessageAutoPlaySetting = () => {
  const audioAutoPlay = useSelector(getAudioAutoplay);
  const dispatch = useDispatch();
  const forceUpdate = useUpdate();

  return (
    <SessionToggleWithDescription
      onClickToggle={() => {
        dispatch(toggleAudioAutoplay());
        forceUpdate();
      }}
      title={window.i18n('audioMessageAutoplayTitle')}
      description={window.i18n('audioMessageAutoplayDescription')}
      active={audioAutoPlay}
    />
  );
};

const EnterKeyFunctionSetting = () => {
  const initialSetting = useHasEnterSendEnabled();
  const selectedWithSettingTrue = 'enterForNewLine';

  const items = [
    {
      label: window.i18n('enterSendNewMessageDescription'),
      value: 'enterForSend',
    },
    {
      label: window.i18n('enterNewLineDescription'),
      value: selectedWithSettingTrue,
    },
  ];

  return (
    <SessionSettingsItemWrapper
      title={window.i18n('enterKeySettingTitle')}
      description={window.i18n('enterKeySettingDescription')}
      inline={false}
    >
      <SessionRadioGroup
        initialItem={initialSetting ? 'enterForNewLine' : 'enterForSend'}
        group={SettingsKey.hasShiftSendEnabled} // make sure to define this key in your SettingsKey enum
        items={items}
        onClick={(selectedRadioValue: string) => {
          void window.setSettingValue(
            SettingsKey.hasShiftSendEnabled,
            selectedRadioValue === selectedWithSettingTrue
          );
        }}
      />
    </SessionSettingsItemWrapper>
  );
};

export const CategoryConversations = () => {
  return (
    <>
      <CommunitiesPruningSetting />
      <SpellCheckSetting />
      <AudioMessageAutoPlaySetting />
      <EnterKeyFunctionSetting />
      <BlockedContactsList />
    </>
  );
};
