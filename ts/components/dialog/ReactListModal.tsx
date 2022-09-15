import { isEmpty, isEqual } from 'lodash';
import React, { ReactElement, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { useMessageReactsPropsById, useWeAreModerator } from '../../hooks/useParamSelector';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { UserUtils } from '../../session/utils';
import {
  updateReactClearAllModal,
  updateReactListModal,
  updateUserDetailsModal,
} from '../../state/ducks/modalDialog';
import { SortedReactionList } from '../../types/Reaction';
import { nativeEmojiData } from '../../util/emoji';
import { Reactions } from '../../util/reactions';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { Flex } from '../basic/Flex';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { ContactName } from '../conversation/ContactName';
import { MessageReactions } from '../conversation/message/message-content/MessageReactions';
import { SessionIconButton } from '../icon';
import { SessionWrapperModal } from '../SessionWrapperModal';

const StyledReactListContainer = styled(Flex)`
  width: 376px;
`;

const StyledReactionsContainer = styled.div`
  background-color: var(--color-cell-background);
  border-bottom: 1px solid var(--color-session-border);
  width: 100%;
  overflow-x: auto;
  padding: 12px 8px 0;
`;

const StyledSendersContainer = styled(Flex)`
  width: 100%;
  min-height: 332px;
  height: 100%;
  max-height: 496px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 16px 16px;
`;

const StyledReactionBar = styled(Flex)`
  width: 100%;
  margin: 12px 0 20px 4px;

  p {
    color: var(--color-text-subtle);
    margin: 0;

    span:nth-child(1) {
      margin: 0 8px;
      color: var(--color-text);
      white-space: nowrap;
    }

    span:nth-child(2) {
      margin-right: 8px;
    }
  }
`;

const StyledReactionSender = styled(Flex)`
  width: 100%;
  margin-bottom: 12px;
  .module-avatar {
    margin-right: 12px;
  }

  .module-conversation__user__profile-name {
    color: var(--color-text);
    font-weight: normal;
  }
`;

const StyledClearButton = styled.button`
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
  border: none;
`;

type ReactionSendersProps = {
  messageId: string;
  currentReact: string;
  senders: Array<string>;
  me: string;
  handleClose: () => void;
};

const ReactionSenders = (props: ReactionSendersProps) => {
  const { messageId, currentReact, senders, me, handleClose } = props;
  const dispatch = useDispatch();

  const handleAvatarClick = async (sender: string) => {
    const message = await Data.getMessageById(messageId);
    if (message) {
      handleClose();
      const contact = message.findAndFormatContact(sender);
      dispatch(
        updateUserDetailsModal({
          conversationId: sender,
          userName: contact.name || contact.profileName || sender,
          authorAvatarPath: contact.avatarPath,
        })
      );
    }
  };

  const handleRemoveReaction = async () => {
    await Reactions.sendMessageReaction(messageId, currentReact);

    if (senders.length <= 1) {
      dispatch(updateReactListModal(null));
    }
  };

  return (
    <>
      {senders.map((sender: string) => (
        <StyledReactionSender
          key={`${messageId}-${sender}`}
          container={true}
          justifyContent={'space-between'}
          alignItems={'center'}
        >
          <Flex container={true} alignItems={'center'}>
            <Avatar
              size={AvatarSize.XS}
              pubkey={sender}
              onAvatarClick={async () => {
                await handleAvatarClick(sender);
              }}
            />
            {sender === me ? (
              window.i18n('you')
            ) : (
              <ContactName
                pubkey={sender}
                module="module-conversation__user"
                shouldShowPubkey={false}
              />
            )}
          </Flex>
          {sender === me && (
            <SessionIconButton
              iconType="exit"
              iconSize="small"
              onClick={async () => {
                await handleRemoveReaction();
              }}
            />
          )}
        </StyledReactionSender>
      ))}
    </>
  );
};

const StyledCountText = styled.p`
  color: var(--color-text-subtle);
  text-align: center;
  margin: 16px auto 0;

  span {
    color: var(--color-text);
  }
`;

const CountText = ({ count, emoji }: { count: number; emoji: string }) => {
  return (
    <StyledCountText>
      <SessionHtmlRenderer
        html={
          count > Reactions.SOGSReactorsFetchCount + 1
            ? window.i18n('reactionListCountPlural', [
                window.i18n('otherPlural', [String(count - Reactions.SOGSReactorsFetchCount)]),
                emoji,
              ])
            : window.i18n('reactionListCountSingular', [
                window.i18n('otherSingular', [String(count - Reactions.SOGSReactorsFetchCount)]),
                emoji,
              ])
        }
      />
    </StyledCountText>
  );
};

type Props = {
  reaction: string;
  messageId: string;
};

const handleSenders = (senders: Array<string>, me: string) => {
  let updatedSenders = [...senders];
  const blindedMe = updatedSenders.filter(isUsAnySogsFromCache);

  let meIndex = -1;
  if (blindedMe && blindedMe[0]) {
    meIndex = updatedSenders.indexOf(blindedMe[0]);
  } else {
    meIndex = updatedSenders.indexOf(me);
  }
  if (meIndex >= 0) {
    updatedSenders.splice(meIndex, 1);
    updatedSenders = [me, ...updatedSenders];
  }

  return updatedSenders;
};

// tslint:disable-next-line: max-func-body-length
export const ReactListModal = (props: Props): ReactElement => {
  const { reaction, messageId } = props;

  const dispatch = useDispatch();
  const [reactions, setReactions] = useState<SortedReactionList>([]);
  const reactionsMap = (reactions && Object.fromEntries(reactions)) || {};
  const [currentReact, setCurrentReact] = useState('');
  const [reactAriaLabel, setReactAriaLabel] = useState<string | undefined>();
  const [count, setCount] = useState<number | null>(null);
  const [senders, setSenders] = useState<Array<string>>([]);

  const msgProps = useMessageReactsPropsById(messageId);
  const weAreModerator = useWeAreModerator(msgProps?.convoId);
  const me = UserUtils.getOurPubKeyStrFromCache();

  // tslint:disable: cyclomatic-complexity
  useEffect(() => {
    if (currentReact === '' && currentReact !== reaction) {
      setReactAriaLabel(
        nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[reaction] : undefined
      );
      setCurrentReact(reaction);
    }

    if (msgProps?.sortedReacts && !isEqual(reactions, msgProps?.sortedReacts)) {
      setReactions(msgProps?.sortedReacts);
    }

    if (
      reactions &&
      reactions.length > 0 &&
      (msgProps?.sortedReacts === [] || msgProps?.sortedReacts === undefined)
    ) {
      setReactions([]);
    }

    let _senders =
      reactionsMap && reactionsMap[currentReact] && reactionsMap[currentReact].senders
        ? reactionsMap[currentReact].senders
        : null;

    if (_senders && !isEqual(senders, _senders)) {
      if (_senders.length > 0) {
        _senders = handleSenders(_senders, me);
      }
      setSenders(_senders);
    }

    if (senders.length > 0 && (!reactionsMap[currentReact]?.senders || isEmpty(_senders))) {
      setSenders([]);
    }

    if (reactionsMap[currentReact]?.count && count !== reactionsMap[currentReact]?.count) {
      setCount(reactionsMap[currentReact].count);
    }
  }, [
    count,
    currentReact,
    me,
    reaction,
    reactionsMap[currentReact]?.count,
    msgProps?.sortedReacts,
    reactionsMap,
    senders,
  ]);

  if (!msgProps) {
    return <></>;
  }

  const { isPublic } = msgProps;

  const handleSelectedReaction = (emoji: string): boolean => {
    return currentReact === emoji;
  };

  const handleReactionClick = (emoji: string) => {
    setReactAriaLabel(nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined);
    setCurrentReact(emoji);
  };

  const handleClose = () => {
    dispatch(updateReactListModal(null));
  };

  const handleClearReactions = (event: any) => {
    event.preventDefault();
    handleClose();
    dispatch(
      updateReactClearAllModal({
        reaction: currentReact,
        messageId,
      })
    );
  };

  return (
    <SessionWrapperModal
      additionalClassName={'reaction-list-modal'}
      showHeader={false}
      onClose={handleClose}
    >
      <StyledReactListContainer container={true} flexDirection={'column'} alignItems={'flex-start'}>
        <StyledReactionsContainer>
          <MessageReactions
            messageId={messageId}
            hasReactLimit={false}
            inModal={true}
            onSelected={handleSelectedReaction}
            onClick={handleReactionClick}
          />
        </StyledReactionsContainer>
        {reactionsMap && currentReact && (
          <StyledSendersContainer
            container={true}
            flexDirection={'column'}
            alignItems={'flex-start'}
          >
            <StyledReactionBar
              container={true}
              justifyContent={'space-between'}
              alignItems={'center'}
            >
              <p>
                <span role={'img'} aria-label={reactAriaLabel}>
                  {currentReact}
                </span>
                {reactionsMap[currentReact].count && (
                  <>
                    <span>&#8226;</span>
                    <span>{reactionsMap[currentReact].count}</span>
                  </>
                )}
              </p>
              {isPublic && weAreModerator && (
                <StyledClearButton onClick={handleClearReactions}>
                  {window.i18n('clearAll')}
                </StyledClearButton>
              )}
            </StyledReactionBar>
            {senders && senders.length > 0 && (
              <ReactionSenders
                messageId={messageId}
                currentReact={currentReact}
                senders={senders}
                me={me}
                handleClose={handleClose}
              />
            )}
            {isPublic && currentReact && count && count > Reactions.SOGSReactorsFetchCount && (
              <CountText count={count} emoji={currentReact} />
            )}
          </StyledSendersContainer>
        )}
      </StyledReactListContainer>
    </SessionWrapperModal>
  );
};
