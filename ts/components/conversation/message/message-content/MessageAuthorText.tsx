import styled from 'styled-components';
import { PubKey } from '../../../../session/types';
import {
  useAuthorName,
  useAuthorProfileName,
  useFirstMessageOfSeries,
  useHideAvatarInMsgList,
  useMessageAuthor,
  useMessageDirection,
} from '../../../../state/selectors';
import {
  useSelectedIsGroupOrCommunity,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { ContactName } from '../../ContactName';

type Props = {
  messageId: string;
};

const StyledAuthorContainer = styled(Flex)<{ hideAvatar: boolean }>`
  color: var(--text-primary-color);
  text-overflow: ellipsis;
  margin-inline-start: ${props => (props.hideAvatar ? 0 : 'var(--width-avatar-group-msg-list)')};
`;

export const MessageAuthorText = (props: Props) => {
  const isPublic = useSelectedIsPublic();
  const isGroup = useSelectedIsGroupOrCommunity();
  const authorProfileName = useAuthorProfileName(props.messageId);
  const authorName = useAuthorName(props.messageId);
  const sender = useMessageAuthor(props.messageId);
  const direction = useMessageDirection(props.messageId);
  const firstMessageOfSeries = useFirstMessageOfSeries(props.messageId);
  const hideAvatar = useHideAvatarInMsgList(props.messageId);

  if (!props.messageId || !sender || !direction) {
    return null;
  }

  const title = authorName || sender;

  if (direction !== 'incoming' || !isGroup || !title || !firstMessageOfSeries) {
    return null;
  }

  const displayedPubkey = authorProfileName ? PubKey.shorten(sender) : sender;

  return (
    <StyledAuthorContainer container={true} hideAvatar={hideAvatar}>
      <ContactName
        pubkey={displayedPubkey}
        name={authorName}
        profileName={authorProfileName}
        module="module-message__author"
        boldProfileName={true}
        shouldShowPubkey={Boolean(isPublic)}
      />
    </StyledAuthorContainer>
  );
};
