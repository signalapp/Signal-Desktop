import React, { useState } from 'react';
import classNames from 'classnames';

import { SessionButton, SessionButtonColor, SessionButtonType } from './SessionButton';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { SessionSettingCategory } from './settings/SessionSettings';
import { DefaultTheme } from 'styled-components';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { deleteAccount } from '../../util/accountManager';
import { useDispatch, useSelector } from 'react-redux';
import { showSettingsSection } from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { getTheme } from '../../state/selectors/theme';
import { SessionConfirm } from './SessionConfirm';

type Props = {
  settingsCategory: SessionSettingCategory;
  showSettingsSection: (category: SessionSettingCategory) => void;
  theme: DefaultTheme;
};

const getCategories = () => {
  return [
    {
      id: SessionSettingCategory.Appearance,
      title: window.i18n('appearanceSettingsTitle'),
      hidden: false,
    },
    {
      id: SessionSettingCategory.Privacy,
      title: window.i18n('privacySettingsTitle'),
      hidden: false,
    },
    {
      id: SessionSettingCategory.Blocked,
      title: window.i18n('blockedSettingsTitle'),
      hidden: false,
    },
    {
      id: SessionSettingCategory.Permissions,
      title: window.i18n('permissionSettingsTitle'),
      hidden: true,
    },
    {
      id: SessionSettingCategory.Notifications,
      title: window.i18n('notificationsSettingsTitle'),
      hidden: false,
    },
  ];
};

const LeftPaneSettingsCategoryRow = (props: { item: any }) => {
  const { item } = props;

  const dispatch = useDispatch();
  const theme = useSelector(getTheme);
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  return (
    <div
      key={item.id}
      className={classNames(
        'left-pane-setting-category-list-item',
        item.id === focusedSettingsSection ? 'active' : ''
      )}
      role="link"
      onClick={() => {
        dispatch(showSettingsSection(item.id));
      }}
    >
      <div>
        <strong>{item.title}</strong>
      </div>

      <div>
        {item.id === focusedSettingsSection && (
          <SessionIcon
            iconSize={SessionIconSize.Medium}
            iconType={SessionIconType.Chevron}
            iconRotation={270}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
};

const LeftPaneSettingsCategories = () => {
  const categories = getCategories();

  return (
    <div className="module-left-pane__list" key={0}>
      <div className="left-pane-setting-category-list">
        {categories
          .filter(m => !m.hidden)
          .map(item => {
            return <LeftPaneSettingsCategoryRow key={item.id} item={item} />;
          })}
      </div>
    </div>
  );
};

const onDeleteAccount = ( setModal: any) => {
  const title = window.i18n('clearAllData');
  const message = window.i18n('deleteAccountWarning');

  // window.confirmationDialog({
  //   title,
  //   message,
  //   resolve: deleteAccount,
  //   okTheme: 'danger',
  // });

  const clearModal = () => {
    setModal(null);
  }

  setModal(
  <SessionConfirm
    title={title}
    message={message}
    onClickOk={deleteAccount}
    okTheme={SessionButtonColor.Danger}
    onClickClose={clearModal}
  />)
};

const LeftPaneBottomButtons = (props: { setModal: any}) => {
  const dangerButtonText = window.i18n('clearAllData');
  const showRecoveryPhrase = window.i18n('showRecoveryPhrase');
  const { setModal } = props;

  return (
    <div className="left-pane-setting-bottom-buttons">
      <SessionButton
        text={dangerButtonText}
        buttonType={SessionButtonType.SquareOutline}
        buttonColor={SessionButtonColor.Danger}
        onClick={() => onDeleteAccount(setModal)}
      />

      <SessionButton
        text={showRecoveryPhrase}
        buttonType={SessionButtonType.SquareOutline}
        buttonColor={SessionButtonColor.White}
        onClick={() => window.Whisper.events.trigger('showSeedDialog')}
      />
    </div>
  );
};

export const LeftPaneSettingSection = (props: { setModal: any}) => {
  const theme = useSelector(getTheme);
  const { setModal } = props;

  return (
    <div className="left-pane-setting-section">
      <LeftPaneSectionHeader label={window.i18n('settingsHeader')} theme={theme} />
      <div className="left-pane-setting-content">
        <LeftPaneSettingsCategories />
        <LeftPaneBottomButtons setModal={setModal} />
      </div>
    </div>
  );
};
