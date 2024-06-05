import { RefObject, useState } from 'react';
import { Mention, MentionsInput } from 'react-mentions';
import { getConversationController } from '../../../session/conversations';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
  useSelectedIsLeft,
} from '../../../state/selectors/selectedConversation';
import { HTMLDirection, useHTMLDirection } from '../../../util/i18n';
import { updateDraftForConversation } from '../SessionConversationDrafts';
import { renderEmojiQuickResultRow, searchEmojiForQuery } from './EmojiQuickResult';
import { renderUserMentionRow, styleForCompositionBoxSuggestions } from './UserMentions';

const sendMessageStyle = (dir?: HTMLDirection) => {
  return {
    control: {
      wordBreak: 'break-all',
    },
    input: {
      overflow: 'auto',
      maxHeight: '50vh',
      wordBreak: 'break-word',
      padding: '0px',
      margin: '0px',
    },
    highlighter: {
      boxSizing: 'border-box',
      overflow: 'hidden',
      maxHeight: '50vh',
    },
    flexGrow: 1,
    minHeight: '24px',
    width: '100%',
    ...styleForCompositionBoxSuggestions(dir),
  };
};

type Props = {
  draft: string;
  setDraft: (draft: string) => void;
  container: RefObject<HTMLDivElement>;
  textAreaRef: RefObject<HTMLTextAreaElement>;
  fetchUsersForGroup: (query: string, callback: (data: any) => void) => void;
  typingEnabled: boolean;
  onKeyDown: (event: any) => void;
};

export const CompositionTextArea = (props: Props) => {
  const { draft, setDraft, container, textAreaRef, fetchUsersForGroup, typingEnabled, onKeyDown } =
    props;

  const [lastBumpTypingMessageLength, setLastBumpTypingMessageLength] = useState(0);

  const selectedConversationKey = useSelectedConversationKey();
  const htmlDirection = useHTMLDirection();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const left = useSelectedIsLeft();
  const isBlocked = useSelectedIsBlocked();

  if (!selectedConversationKey) {
    return null;
  }

  const makeMessagePlaceHolderText = () => {
    if (isKickedFromGroup) {
      return window.i18n('youGotKickedFromGroup');
    }
    if (left) {
      return window.i18n('youLeftTheGroup');
    }
    if (isBlocked) {
      return window.i18n('unblockToSend');
    }
    return window.i18n('sendMessage');
  };

  const messagePlaceHolder = makeMessagePlaceHolderText();
  const neverMatchingRegex = /($a)/;

  const style = sendMessageStyle(htmlDirection);

  const handleOnChange = (event: any) => {
    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }

    const newDraft = event.target.value ?? '';
    setDraft(newDraft);
    updateDraftForConversation({ conversationKey: selectedConversationKey, draft: newDraft });
  };

  const handleKeyUp = async () => {
    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    /** Called whenever the user changes the message composition field. But only fires if there's content in the message field after the change.
    Also, check for a message length change before firing it up, to avoid catching ESC, tab, or whatever which is not typing
     */
    if (draft && draft.length && draft.length !== lastBumpTypingMessageLength) {
      const conversationModel = getConversationController().get(selectedConversationKey);
      if (!conversationModel) {
        return;
      }
      conversationModel.throttledBumpTyping();
      setLastBumpTypingMessageLength(draft.length);
    }
  };

  return (
    <MentionsInput
      value={draft}
      onChange={handleOnChange}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onKeyDown={onKeyDown}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onKeyUp={handleKeyUp}
      placeholder={messagePlaceHolder}
      spellCheck={true}
      dir={htmlDirection}
      inputRef={textAreaRef}
      disabled={!typingEnabled}
      rows={1}
      data-testid="message-input-text-area"
      style={style}
      suggestionsPortalHost={container.current || undefined}
      forceSuggestionsAboveCursor={true} // force mentions to be rendered on top of the cursor, this is working with a fork of react-mentions for now
    >
      <Mention
        appendSpaceOnAdd={true}
        // this will be cleaned on cleanMentions()
        markup="@ￒ__id__ￗ__display__ￒ" // ￒ = \uFFD2 is one of the forbidden char for a display name (check displayNameRegex)
        trigger="@"
        // this is only for the composition box visible content. The real stuff on the backend box is the @markup
        displayTransform={(_id, display) =>
          htmlDirection === 'rtl' ? `${display}@` : `@${display}`
        }
        data={fetchUsersForGroup}
        renderSuggestion={renderUserMentionRow}
      />
      <Mention
        trigger=":"
        markup="__id__"
        appendSpaceOnAdd={true}
        regex={neverMatchingRegex}
        data={searchEmojiForQuery}
        renderSuggestion={renderEmojiQuickResultRow}
      />
    </MentionsInput>
  );
};
