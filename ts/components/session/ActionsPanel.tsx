import React, { useEffect } from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';
import { darkTheme, lightTheme } from '../../state/ducks/SessionTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { ConversationType } from '../../state/ducks/conversations';
import { DefaultTheme } from 'styled-components';
import { ConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { syncConfigurationIfNeeded } from '../../session/utils/syncUtils';
import { DAYS } from '../../session/utils/Number';
import {
  getItemById,
  hasSyncedInitialConfigurationItem,
  removeItemById,
} from '../../data/data';
import { OnionPaths } from '../../session/onions';
import { getMessageQueue } from '../../session/sending';
import { clearSessionsAndPreKeys } from '../../util/accountManager';
import { useDispatch, useSelector } from 'react-redux';
import { getOurNumber } from '../../state/selectors/user';
import {
  getOurPrimaryConversation,
  getUnreadMessageCount,
} from '../../state/selectors/conversations';
import { getTheme } from '../../state/selectors/theme';
import { applyTheme } from '../../state/ducks/theme';
import { getFocusedSection } from '../../state/selectors/section';
import { useInterval } from '../../hooks/useInterval';
import { clearSearch } from '../../state/ducks/search';
import { showLeftPaneSection } from '../../state/ducks/section';
import {
  joinOpenGroupV2,
  parseOpenGroupV2,
} from '../../opengroup/opengroupV2/JoinOpenGroupV2';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports

export enum SectionType {
  Profile,
  Message,
  Contact,
  Channel,
  Settings,
  Moon,
}

const Section = (props: { type: SectionType; avatarPath?: string }) => {
  const ourNumber = useSelector(getOurNumber);
  const unreadMessageCount = useSelector(getUnreadMessageCount);
  const theme = useSelector(getTheme);
  const dispatch = useDispatch();
  const { type, avatarPath } = props;

  const focusedSection = useSelector(getFocusedSection);
  const isSelected = focusedSection === props.type;

  const handleClick = () => {
    /* tslint:disable:no-void-expression */
    if (type === SectionType.Profile) {
      window.showEditProfileDialog();
    } else if (type === SectionType.Moon) {
      const themeFromSettings = window.Events.getThemeSetting();
      const updatedTheme = themeFromSettings === 'dark' ? 'light' : 'dark';
      window.setTheme(updatedTheme);

      const newThemeObject = updatedTheme === 'dark' ? darkTheme : lightTheme;
      dispatch(applyTheme(newThemeObject));
    } else {
      dispatch(clearSearch());
      dispatch(showLeftPaneSection(type));
    }
  };

  if (type === SectionType.Profile) {
    const conversation = ConversationController.getInstance().get(ourNumber);

    const profile = conversation?.getLokiProfile();
    const userName = (profile && profile.displayName) || ourNumber;
    return (
      <Avatar
        avatarPath={avatarPath}
        size={28}
        onAvatarClick={handleClick}
        name={userName}
        pubkey={ourNumber}
      />
    );
  }

  let iconType: SessionIconType;
  switch (type) {
    case SectionType.Message:
      iconType = SessionIconType.ChatBubble;
      break;
    case SectionType.Contact:
      iconType = SessionIconType.Users;
      break;
    case SectionType.Settings:
      iconType = SessionIconType.Gear;
      break;
    case SectionType.Moon:
      iconType = SessionIconType.Moon;
      break;

    default:
      iconType = SessionIconType.Moon;
  }

  const unreadToShow =
    type === SectionType.Message ? unreadMessageCount : undefined;

  return (
    <SessionIconButton
      iconSize={SessionIconSize.Medium}
      iconType={iconType}
      notificationCount={unreadToShow}
      onClick={handleClick}
      isSelected={isSelected}
      theme={theme}
    />
  );
};

const showResetSessionIDDialogIfNeeded = async () => {
  const userED25519KeyPairHex = await UserUtils.getUserED25519KeyPair();
  if (userED25519KeyPairHex) {
    return;
  }

  window.showResetSessionIdDialog();
};

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const dispatch = useDispatch();

  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);

  // this maxi useEffect is called only once: when the component is mounted.
  useEffect(() => {
    void window.setClockParams();
    if (
      window.lokiFeatureFlags.useOnionRequests ||
      window.lokiFeatureFlags.useFileOnionRequests
    ) {
      // Initialize paths for onion requests
      void OnionPaths.getInstance().buildNewOnionPaths();
    }

    // init the messageQueue. In the constructor, we had all not send messages
    // this call does nothing except calling the constructor, which will continue sending message in the pipeline
    void getMessageQueue().processAllPending();

    const theme = window.Events.getThemeSetting();
    window.setTheme(theme);

    const newThemeObject = theme === 'dark' ? darkTheme : lightTheme;
    dispatch(applyTheme(newThemeObject));

    void showResetSessionIDDialogIfNeeded();
    // remove existing prekeys, sign prekeys and sessions
    void clearSessionsAndPreKeys();
    // we consider people had the time to upgrade, so remove this id from the db
    // it was used to display a dialog when we added the light mode auto-enabled
    void removeItemById('hasSeenLightModeDialog');

    // Do this only if we created a new Session ID, or if we already received the initial configuration message

    const syncConfiguration = async () => {
      const didWeHandleAConfigurationMessageAlready =
        (await getItemById(hasSyncedInitialConfigurationItem))?.value || false;
      if (didWeHandleAConfigurationMessageAlready) {
        await syncConfigurationIfNeeded();
      }
    };

    // trigger a sync message if needed for our other devices
    //       'http://sessionopengroup.com/main?public_key=658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b'
    //       'https://sog.ibolpap.finance/main?public_key=b464aa186530c97d6bcf663a3a3b7465a5f782beaa67c83bee99468824b4aa10'

    void syncConfiguration();
    const parsedRoom = parseOpenGroupV2(
      'https://sog.ibolpap.finance/main?public_key=b464aa186530c97d6bcf663a3a3b7465a5f782beaa67c83bee99468824b4aa10'
    );
    if (parsedRoom) {
      setTimeout(() => void joinOpenGroupV2(parsedRoom), 10000);
    }
  }, []);

  if (!ourPrimaryConversation) {
    window.log.warn('ActionsPanel: ourPrimaryConversation is not set');
    return <></>;
  }

  useInterval(() => {
    void syncConfigurationIfNeeded();
  }, DAYS * 2);

  return (
    <div className="module-left-pane__sections-container">
      <Section
        type={SectionType.Profile}
        avatarPath={ourPrimaryConversation.avatarPath}
      />
      <Section type={SectionType.Message} />
      <Section type={SectionType.Contact} />
      <Section type={SectionType.Settings} />

      <SessionToastContainer />
      <Section type={SectionType.Moon} />
    </div>
  );
};
