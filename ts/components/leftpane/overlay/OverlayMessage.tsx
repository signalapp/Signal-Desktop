import { useState } from 'react';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { useDispatch } from 'react-redux';
import { ConversationTypeEnum } from '../../../models/conversationAttributes';
import { getConversationController } from '../../../session/conversations';
import { PubKey } from '../../../session/types';
import { ToastUtils, UserUtils } from '../../../session/utils';
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import { ONSResolve } from '../../../session/apis/snode_api/onsResolve';
import { NotFoundError, SnodeResponseError } from '../../../session/utils/errors';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { YourSessionIDPill, YourSessionIDSelectable } from '../../basic/YourSessionIDPill';
import { SessionIconButton } from '../../icon';
import { SessionInput } from '../../inputs';

const SessionIDDescription = styled.div`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  text-align: center;
`;

const StyledLeftPaneOverlay = styled(Flex)`
  background: var(--background-primary-color);
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: var(--margins-md);

  .session-button {
    min-width: 160px;
    width: fit-content;
    margin-top: 1rem;
    margin-bottom: 3rem;
    flex-shrink: 0;
  }
`;

function copyOurSessionID() {
  const ourSessionId = UserUtils.getOurPubKeyStrFromCache();
  if (!ourSessionId) {
    return;
  }
  window.clipboard.writeText(ourSessionId);
  ToastUtils.pushCopiedToClipBoard();
}

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
    if (isPubkey && validationError) {
      setPubkeyOrOnsError(validationError);
      return;
    }

    // this might be an ONS, validate the regex first
    const mightBeOnsName = new RegExp(ONSResolve.onsNameRegex, 'g').test(pubkeyorOnsTrimmed);
    if (!mightBeOnsName) {
      setPubkeyOrOnsError(window.i18n('onsErrorNotRecognised'));
      return;
    }

    setLoading(true);
    try {
      const resolvedSessionID = await ONSResolve.getSessionIDForOnsName(pubkeyorOnsTrimmed);
      const idValidationError = PubKey.validateWithErrorNoBlinding(resolvedSessionID);

      if (idValidationError) {
        setPubkeyOrOnsError(window.i18n('onsErrorNotRecognised'));
        return;
      }

      await openConvoOnceResolved(resolvedSessionID);
    } catch (e) {
      setPubkeyOrOnsError(
        e instanceof SnodeResponseError
          ? window.i18n('onsErrorUnableToSearch')
          : e instanceof NotFoundError
            ? window.i18n('onsErrorNotRecognised')
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
    >
      {/* TODO[epic=893] Replace everywhere and test new error handling */}
      {/* <SessionIdEditable
        editable={!loading}
        placeholder={placeholder}
        onChange={setPubkeyOrOns}
        dataTestId="new-session-conversation"
        onPressEnter={handleMessageButtonClick}
      /> */}

      <div style={{ width: '90%', margin: '0 auto' }}>
        <SessionInput
          autoFocus={true}
          type="text"
          placeholder={window.i18n('accountIdOrOnsEnter')}
          value={pubkeyOrOns}
          onValueChanged={setPubkeyOrOns}
          onEnterPressed={handleMessageButtonClick}
          error={pubkeyOrOnsError}
          isSpecial={true}
          centerText={true}
          inputDataTestId="new-session-conversation"
        />
      </div>
      <SpacerLG />

      <SessionSpinner loading={loading} />

      <SessionIDDescription>{window.i18n('messageNewDescription')}</SessionIDDescription>

      <Flex container={true} width="100%">
        <SpacerMD />
        <YourSessionIDPill />
        <SpacerMD />
      </Flex>
      <Flex
        container={true}
        justifyContent="space-between"
        alignItems="center"
        width="100%"
        padding="0 var(--margins-sm)" // YourSessionIDSelectable already has a left margin of 15px
      >
        <YourSessionIDSelectable />
        <SessionIconButton iconSize="small" iconType="copy" onClick={copyOurSessionID} />
      </Flex>
      <SessionButton
        text={window.i18n('next')}
        disabled={disableNextButton}
        onClick={handleMessageButtonClick}
        dataTestId="next-new-conversation-button"
      />
    </StyledLeftPaneOverlay>
  );
};
