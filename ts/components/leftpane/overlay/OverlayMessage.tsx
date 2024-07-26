import { useState } from 'react';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { motion } from 'framer-motion';
import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { getConversationController } from '../../../session/conversations';
import { PubKey } from '../../../session/types';
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import { ONSResolve } from '../../../session/apis/snode_api/onsResolve';
import { NotFoundError, SnodeResponseError } from '../../../session/utils/errors';
import { THEME_GLOBALS } from '../../../themes/globals';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { HelpDeskButton } from '../../buttons';
import { SessionInput } from '../../inputs';
import { ConversationTypeEnum } from '../../../models/types';

const StyledDescriptionContainer = styled(motion.div)`
  margin: 0 auto;
  text-align: center;
  padding: 0 var(--margins-md);

  .session-icon-button {
    border: 1px solid var(--text-secondary-color);
    border-radius: 9999px;
    margin-inline-start: var(--margins-xs);
    transition-duration: var(--default-duration);

    &:hover {
      border-color: var(--text-primary-color);
    }
  }
`;

const SessionIDDescription = styled.span`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  text-align: center;
`;

export const StyledLeftPaneOverlay = styled(Flex)`
  background: var(--background-primary-color);
  overflow-y: auto;
  overflow-x: hidden;

  .session-button {
    width: 100%;
  }
`;

export const OverlayMessage = () => {
  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  useKey('Escape', closeOverlay);
  const [pubkeyOrOns, setPubkeyOrOns] = useState('');
  const [pubkeyOrOnsError, setPubkeyOrOnsError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const disableNextButton = !pubkeyOrOns || loading;

  async function openConvoOnceResolved(resolvedSessionID: string) {
    const convo = await getConversationController().getOrCreateAndWait(
      resolvedSessionID,
      ConversationTypeEnum.PRIVATE
    );

    // we now want to show a conversation we just started on the leftpane, even if we did not send a message to it yet
    if (!convo.isActive() || convo.isHidden()) {
      // bump the timestamp only if we were not active before
      if (!convo.isActive()) {
        convo.set({ active_at: Date.now() });
      }
      await convo.unhideIfNeeded(false);

      await convo.commit();
    }

    await openConversationWithMessages({ conversationKey: resolvedSessionID, messageId: null });

    closeOverlay();
  }

  async function handleMessageButtonClick() {
    setPubkeyOrOnsError(undefined);

    if ((!pubkeyOrOns && !pubkeyOrOns.length) || !pubkeyOrOns.trim().length) {
      setPubkeyOrOnsError(window.i18n('accountIdErrorInvalid'));
      return;
    }

    const pubkeyorOnsTrimmed = pubkeyOrOns.trim();
    const validationError = PubKey.validateWithErrorNoBlinding(pubkeyorOnsTrimmed);

    if (!validationError) {
      await openConvoOnceResolved(pubkeyorOnsTrimmed);
      return;
    }

    const isPubkey = PubKey.validate(pubkeyorOnsTrimmed);
    const isGroupPubkey = PubKey.isClosedGroupV3(pubkeyorOnsTrimmed);
    if ((isPubkey && validationError) || isGroupPubkey) {
      setPubkeyOrOnsError(validationError);
      return;
    }

    // this might be an ONS, validate the regex first
    const mightBeOnsName = new RegExp(ONSResolve.onsNameRegex, 'g').test(pubkeyorOnsTrimmed);
    if (!mightBeOnsName) {
      setPubkeyOrOnsError(window.i18n('onsErrorNotRecognized'));
      return;
    }

    setLoading(true);
    try {
      const resolvedSessionID = await ONSResolve.getSessionIDForOnsName(pubkeyorOnsTrimmed);
      const idValidationError = PubKey.validateWithErrorNoBlinding(resolvedSessionID);

      if (idValidationError) {
        setPubkeyOrOnsError(window.i18n('onsErrorNotRecognized'));
        return;
      }

      await openConvoOnceResolved(resolvedSessionID);
    } catch (e) {
      setPubkeyOrOnsError(
        e instanceof SnodeResponseError
          ? window.i18n('onsErrorUnableToSearch')
          : e instanceof NotFoundError
            ? window.i18n('onsErrorNotRecognized')
            : window.i18n('failedResolveOns')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <StyledLeftPaneOverlay
      container={true}
      flexDirection={'column'}
      flexGrow={1}
      alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      <SessionInput
        ariaLabel="New conversation input"
        autoFocus={true}
        type="text"
        placeholder={window.i18n('accountIdOrOnsEnter')}
        value={pubkeyOrOns}
        onValueChanged={setPubkeyOrOns}
        onEnterPressed={handleMessageButtonClick}
        error={pubkeyOrOnsError}
        centerText={true}
        isTextArea={true}
        inputDataTestId="new-session-conversation"
      />
      <SpacerMD />
      <SessionSpinner loading={loading} />

      {!pubkeyOrOnsError && !loading ? (
        <>
          <StyledDescriptionContainer
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
          >
            <SessionIDDescription>{window.i18n('messageNewDescription')}</SessionIDDescription>
            <HelpDeskButton style={{ display: 'inline-flex' }} />
          </StyledDescriptionContainer>
          <SpacerLG />
        </>
      ) : null}

      {!isEmpty(pubkeyOrOns) ? (
        <SessionButton
          ariaLabel={window.i18n('continue')}
          text={window.i18n('continue')}
          disabled={disableNextButton}
          onClick={handleMessageButtonClick}
          dataTestId="next-new-conversation-button"
        />
      ) : null}
    </StyledLeftPaneOverlay>
  );
};
