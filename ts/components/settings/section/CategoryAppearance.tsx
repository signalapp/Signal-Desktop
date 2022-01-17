import { ipcRenderer, shell } from 'electron';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import {
  createOrUpdateItem,
  fillWithTestData,
  hasLinkPreviewPopupBeenDisplayed,
} from '../../../data/data';
import { ToastUtils } from '../../../session/utils';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { toggleAudioAutoplay } from '../../../state/ducks/userConfig';
import { getAudioAutoplay } from '../../../state/selectors/userConfig';
import { SessionButtonColor } from '../../basic/SessionButton';

import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { ZoomingSessionSlider } from '../ZoomingSessionSlider';

async function toggleLinkPreviews() {
  const newValue = !window.getSettingValue('link-preview-setting');
  window.setSettingValue('link-preview-setting', newValue);
  if (!newValue) {
    await createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: false });
  } else {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('linkPreviewsTitle'),
        message: window.i18n('linkPreviewsConfirmMessage'),
        okTheme: SessionButtonColor.Danger,
      })
    );
  }
}

async function toggleStartInTray() {
  try {
    const newValue = !(await window.getStartInTray());

    // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
    window.setSettingValue('start-in-tray-setting', newValue);
    await window.setStartInTray(newValue);
    if (!newValue) {
      ToastUtils.pushRestartNeeded();
    }
  } catch (e) {
    window.log.warn('start in tray change error:', e);
  }
}

const settingsMenuBar = 'hide-menu-bar';
const settingsSpellCheck = 'spell-check';
const settingsLinkPreview = 'link-preview-setting';
const settingsStartInTray = 'start-in-tray-setting';

export const SettingsCategoryAppearance = (props: { hasPassword: boolean | null }) => {
  const dispatch = useDispatch();
  const forceUpdate = useUpdate();
  const audioAutoPlay = useSelector(getAudioAutoplay);

  if (props.hasPassword !== null) {
    const isHideMenuBarActive =
      window.getSettingValue(settingsMenuBar) === undefined
        ? true
        : window.getSettingValue(settingsMenuBar);

    const isSpellCheckActive =
      window.getSettingValue(settingsSpellCheck) === undefined
        ? true
        : window.getSettingValue(settingsSpellCheck);

    const isLinkPreviewsOn = Boolean(window.getSettingValue(settingsLinkPreview));
    const isStartInTrayActive = Boolean(window.getSettingValue(settingsStartInTray));

    return (
      <>
        {window.Signal.Types.Settings.isHideMenuBarSupported() && (
          <SessionToggleWithDescription
            onClickToggle={() => {
              window.toggleMenuBar();
              forceUpdate();
            }}
            title={window.i18n('hideMenuBarTitle')}
            description={window.i18n('hideMenuBarDescription')}
            active={isHideMenuBarActive}
          />
        )}
        <SessionToggleWithDescription
          onClickToggle={() => {
            window.toggleSpellCheck();
            forceUpdate();
          }}
          title={window.i18n('spellCheckTitle')}
          description={window.i18n('spellCheckDescription')}
          active={isSpellCheckActive}
        />

        <SessionToggleWithDescription
          onClickToggle={async () => {
            await toggleLinkPreviews();
            forceUpdate();
          }}
          title={window.i18n('linkPreviewsTitle')}
          description={window.i18n('linkPreviewDescription')}
          active={isLinkPreviewsOn}
        />
        <SessionToggleWithDescription
          onClickToggle={async () => {
            await toggleStartInTray();
            forceUpdate();
          }}
          title={window.i18n('startInTrayTitle')}
          description={window.i18n('startInTrayDescription')}
          active={isStartInTrayActive}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            dispatch(toggleAudioAutoplay());
            forceUpdate();
          }}
          title={window.i18n('audioMessageAutoplayTitle')}
          description={window.i18n('audioMessageAutoplayDescription')}
          active={audioAutoPlay}
        />
        <ZoomingSessionSlider />
        <SessionSettingButtonItem
          title={window.i18n('surveyTitle')}
          onClick={() => void shell.openExternal('https://getsession.org/survey')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('goToOurSurvey')}
        />
        <SessionSettingButtonItem
          title={window.i18n('helpUsTranslateSession')}
          onClick={() => void shell.openExternal('https://crowdin.com/project/session-desktop/')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('translation')}
        />
        {/* <SessionSettingButtonItem
          title={window.i18n('trimDatabase')}
          description={window.i18n('trimDatabaseDescription')}
          onClick={async () => {
            const msgCount = await getMessageCount();
            const deleteAmount = Math.max(msgCount - 10000, 0);

            dispatch(
              updateConfirmModal({
                onClickOk: () => {
                  void trimMessages();
                },
                onClickClose: () => {
                  updateConfirmModal(null);
                },
                message: window.i18n('trimDatabaseConfirmationBody', [`${deleteAmount}`]),
              })
            );
          }}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('trimDatabase')}
        /> */}
        <SessionSettingButtonItem
          onClick={() => {
            ipcRenderer.send('show-debug-log');
          }}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('showDebugLog')}
        />
        <SessionSettingButtonItem
          onClick={async () => {
            await fillWithTestData(100, 1000);
          }}
          buttonColor={SessionButtonColor.Primary}
          buttonText={'Spam fill DB using cached'}
        />
      </>
    );
  }
  return null;
};
