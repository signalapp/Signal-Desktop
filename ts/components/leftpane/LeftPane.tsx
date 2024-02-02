import React from 'react';

import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SectionType } from '../../state/ducks/section';
import { getLeftPaneConversationIds } from '../../state/selectors/conversations';
import { getHasSearchResults } from '../../state/selectors/search';
import { getFocusedSection, getLeftOverlayMode } from '../../state/selectors/section';
import { SessionTheme } from '../../themes/SessionTheme';
import { SessionToastContainer } from '../SessionToastContainer';
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
  const hasSearchResults = useSelector(getHasSearchResults);
  const conversationIds = useSelector(getLeftPaneConversationIds);
  const leftOverlayMode = useSelector(getLeftOverlayMode);

  return (
    <LeftPaneMessageSection
      hasSearchResults={hasSearchResults}
      conversationIds={conversationIds}
      leftOverlayMode={leftOverlayMode}
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
        <SessionToastContainer />
        <ActionsPanel />

        <StyledLeftPane className="module-left-pane">
          <LeftPaneSection />
        </StyledLeftPane>
      </div>
    </SessionTheme>
  );
};
