import React from 'react';

import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SectionType } from '../../state/ducks/section';
import { SessionTheme } from '../../state/ducks/SessionTheme';
import { getLeftPaneLists } from '../../state/selectors/conversations';
import { getSearchResults, isSearching } from '../../state/selectors/search';
import { getFocusedSection, getOverlayMode } from '../../state/selectors/section';
import { getHideMessageRequestBanner } from '../../state/selectors/userConfig';
import { CallInFullScreenContainer } from '../calling/CallInFullScreenContainer';
import { DraggableCallContainer } from '../calling/DraggableCallContainer';
import { IncomingCallDialog } from '../calling/IncomingCallDialog';
import { ModalContainer } from '../dialog/ModalContainer';
import { ActionsPanel } from './ActionsPanel';
import { LeftPaneMessageSection } from './LeftPaneMessageSection';
import { LeftPaneSettingSection } from './LeftPaneSettingSection';

export const leftPaneListWidth = 300;
const StyledLeftPane = styled.div`
  width: ${leftPaneListWidth}px;
`;

const InnerLeftPaneMessageSection = () => {
  const showSearch = useSelector(isSearching);

  const searchResults = showSearch ? useSelector(getSearchResults) : undefined;

  const lists = showSearch ? undefined : useSelector(getLeftPaneLists);
  const messageRequestsEnabled = useSelector(getHideMessageRequestBanner);
  const overlayMode = useSelector(getOverlayMode);

  return (
    // tslint:disable-next-line: use-simple-attributes
    <LeftPaneMessageSection
      conversations={lists?.conversations || []}
      contacts={lists?.contacts || []}
      searchResults={searchResults}
      messageRequestsEnabled={messageRequestsEnabled}
      overlayMode={overlayMode}
    />
  );
};

const LeftPaneSection = () => {
  const focusedSection = useSelector(getFocusedSection);

  if (focusedSection === SectionType.Message) {
    return <InnerLeftPaneMessageSection />;
  }

  if (focusedSection === SectionType.Settings) {
    return <LeftPaneSettingSection />;
  }
  return null;
};

const CallContainer = () => {
  return (
    <>
      <DraggableCallContainer />
      <IncomingCallDialog />
      <CallInFullScreenContainer />
    </>
  );
};

export const LeftPane = () => {
  return (
    <SessionTheme>
      <div className="module-left-pane-session">
        <ModalContainer />
        <CallContainer />
        <ActionsPanel />

        <StyledLeftPane className="module-left-pane">
          <LeftPaneSection />
        </StyledLeftPane>
      </div>
    </SessionTheme>
  );
};
