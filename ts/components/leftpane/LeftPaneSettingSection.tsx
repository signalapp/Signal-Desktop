import React from 'react';
import classNames from 'classnames';

import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { useDispatch, useSelector } from 'react-redux';
import {
  SectionType,
  setOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { recoveryPhraseModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionIcon } from '../icon';
import { SessionSettingCategory } from '../settings/SessionSettings';
import { resetConversationExternal } from '../../state/ducks/conversations';

const getCategories = () => {
  return [
    {
      id: SessionSettingCategory.Appearance,
      title: window.i18n('appearanceSettingsTitle'),
    },
    {
      id: SessionSettingCategory.Privacy,
      title: window.i18n('privacySettingsTitle'),
    },
    {
      id: SessionSettingCategory.Blocked,
      title: window.i18n('blockedSettingsTitle'),
    },
    {
      id: SessionSettingCategory.Notifications,
      title: window.i18n('notificationsSettingsTitle'),
    },
    {
      id: SessionSettingCategory.MessageRequests,
      title: window.i18n('openMessageRequestInbox'),
    },
  ];
};

const LeftPaneSettingsCategoryRow = (props: {
  item: { id: SessionSettingCategory; title: string };
}) => {
  const { item } = props;
  const { id, title } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const isMessageRequestSetting = id === SessionSettingCategory.MessageRequests;

  const dataTestId = `${title.toLowerCase()}-settings-menu-item`;

  return (
    <div
      data-testid={dataTestId}
      key={id}
      className={classNames(
        'left-pane-setting-category-list-item',
        id === focusedSettingsSection ? 'active' : ''
      )}
      role="link"
      onClick={() => {
        if (isMessageRequestSetting) {
          dispatch(showLeftPaneSection(SectionType.Message));
          dispatch(setOverlayMode('message-requests'));
          dispatch(resetConversationExternal());
        } else {
          dispatch(showSettingsSection(id));
        }
      }}
    >
      <div>
        <strong>{title}</strong>
      </div>

      <div>
        {id === focusedSettingsSection && (
          <SessionIcon iconSize="medium" iconType="chevron" iconRotation={270} />
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
        {categories.map(item => {
          return <LeftPaneSettingsCategoryRow key={item.id} item={item} />;
        })}
      </div>
    </div>
  );
};

const LeftPaneBottomButtons = () => {
  const dangerButtonText = window.i18n('clearAllData');
  const showRecoveryPhrase = window.i18n('showRecoveryPhrase');

  const dispatch = useDispatch();

  return (
    <div className="left-pane-setting-bottom-buttons" key={1}>
      <SessionButton
        text={dangerButtonText}
        buttonType={SessionButtonType.SquareOutline}
        buttonColor={SessionButtonColor.Danger}
        onClick={() => {
          dispatch(updateDeleteAccountModal({}));
        }}
      />

      <SessionButton
        text={showRecoveryPhrase}
        buttonType={SessionButtonType.SquareOutline}
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(recoveryPhraseModal({}));
        }}
      />
    </div>
  );
};

export const LeftPaneSettingSection = () => {
  return (
    <div className="left-pane-setting-section">
      <LeftPaneSectionHeader />
      <div className="left-pane-setting-content">
        <LeftPaneSettingsCategories />
        <LeftPaneBottomButtons />
      </div>
    </div>
  );
};
