import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SectionType } from '../../state/ducks/section';
import { getFocusedSection } from '../../state/selectors/section';
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

const LeftPaneSection = () => {
  const focusedSection = useSelector(getFocusedSection);

  if (focusedSection === SectionType.Message) {
    return <LeftPaneMessageSection />;
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
    <div className="module-left-pane-session">
      <ModalContainer />
      <CallContainer />
      <SessionToastContainer />
      <ActionsPanel />

      <StyledLeftPane className="module-left-pane">
        <LeftPaneSection />
      </StyledLeftPane>
    </div>
  );
};
