import { isEmpty, isEqual } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { useMessageReactsPropsById } from '../../hooks/useParamSelector';
import { findAndFormatContact } from '../../models/message';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { UserUtils } from '../../session/utils';
import {
  updateReactClearAllModal,
  updateReactListModal,
  updateUserDetailsModal,
} from '../../state/ducks/modalDialog';
import {
  useSelectedIsPublic,
  useSelectedWeAreModerator,
} from '../../state/selectors/selectedConversation';
import { SortedReactionList } from '../../types/Reaction';
import { nativeEmojiData } from '../../util/emoji';
import { Reactions } from '../../util/reactions';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { ContactName } from '../conversation/ContactName';
import { MessageReactions } from '../conversation/message/message-content/MessageReactions';
import { SessionIconButton } from '../icon';

const StyledReactListContainer = styled(Flex)`
  width: 376px;
`;

const StyledReactionsContainer = styled.div`
  background-color: var(--modal-background-content-color);
  border-bottom: 1px solid var(--border-color);
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
    color: var(--text-secondary-color);
    margin: 0;

    span:nth-child(1) {
      margin: 0 8px;
      color: var(--text-primary-color);
      white-space: nowrap;
    }

    span:nth-child(2) {
      margin-right: 8px;
    }
  }

  .session-button {
    font-weight: 400;
    padding: 0px;
  }
`;

const StyledReactionSender = styled(Flex)`
  width: 100%;
  margin-bottom: 12px;
  .module-avatar {
    margin-right: 12px;
  }

  .module-conversation__user__profile-name {
    color: var(--text-primary-color);
    font-weight: normal;
  }
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
      const contact = findAndFormatContact(sender);
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
              onAvatarClick={() => {
                void handleAvatarClick(sender);
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
              onClick={() => {
                void handleRemoveReaction();
              }}
            />
          )}
        </StyledReactionSender>
      ))}
    </>
  );
};

const StyledCountText = styled.p`
  color: var(--text-secondary-color);
  text-align: center;
  margin: 16px auto 0;

  span {
    color: var(--text-primary);
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

export const ReactListModal = (props: Props) => {
  const { reaction, messageId } = props;

  const dispatch = useDispatch();
  const [reactions, setReactions] = useState<SortedReactionList>([]);

  const [currentReact, setCurrentReact] = useState('');
  const [reactAriaLabel, setReactAriaLabel] = useState<string | undefined>();
  const [count, setCount] = useState<number | null>(null);
  const [senders, setSenders] = useState<Array<string>>([]);

  const msgProps = useMessageReactsPropsById(messageId);
  const isPublic = useSelectedIsPublic();
  const weAreModerator = useSelectedWeAreModerator();
  const me = UserUtils.getOurPubKeyStrFromCache();

  const reactionsMap = useMemo(() => {
    return (reactions && Object.fromEntries(reactions)) || {};
  }, [reactions]);
  const reactionsCount = reactionsMap[currentReact]?.count;

  // TODO we should break down this useEffect, it is hard to read.
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
      ((msgProps?.sortedReacts && msgProps.sortedReacts.length === 0) ||
        msgProps?.sortedReacts === undefined)
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

      // make sure to deep compare here otherwise we get stuck in a ever rendering look (only happens when we are one of the reactor)
      if (!isEqual(_senders, senders)) {
        setSenders(_senders);
      }
    }

    if (senders.length > 0 && (!reactionsMap[currentReact]?.senders || isEmpty(_senders))) {
      setSenders([]);
    }

    if (reactionsCount && count !== reactionsCount) {
      setCount(reactionsMap[currentReact].count);
    }
  }, [
    count,
    currentReact,
    me,
    reaction,
    reactionsCount,
    msgProps?.sortedReacts,
    reactionsMap,
    senders,
    reactions,
  ]);

  if (!msgProps) {
    return <></>;
  }

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

  const handleClearReactions = () => {
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
            noAvatar={true}
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
                <SessionButton
                  text={window.i18n('clearAll')}
                  buttonColor={SessionButtonColor.Danger}
                  buttonType={SessionButtonType.Simple}
                  onClick={handleClearReactions}
                />
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
