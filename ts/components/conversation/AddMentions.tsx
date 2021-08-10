import React, { useEffect } from 'react';

import { RenderTextCallbackType } from '../../types/Util';
import classNames from 'classnames';
import { PubKey } from '../../session/types';
import { ConversationModel } from '../../models/conversation';
import { UserUtils } from '../../session/utils';
import { getConversationController } from '../../session/conversations';
import _ from 'lodash';

interface MentionProps {
  key: string;
  text: string;
  convoId: string;
}

const Mention = (props: MentionProps) => {
  const foundConvo = getConversationController().get(props.text.slice(1));
  let us = false;
  if (foundConvo) {
    us = UserUtils.isUsFromCache(foundConvo.id);
  }

  if (foundConvo) {
    // TODO: We don't have to search the database of message just to know that the message is for us!
    const className = classNames('mention-profile-name', us && 'mention-profile-name-us');

    const displayedName = foundConvo.getContactProfileNameOrShortenedPubKey();
    return <span className={className}>{displayedName}</span>;
  } else {
    return <span className="mention-profile-name">{PubKey.shorten(props.text)}</span>;
  }
};

interface Props {
  text: string;
  renderOther?: RenderTextCallbackType;
  convoId: string;
}

export class AddMentions extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderOther: ({ text }) => text,
  };

  public render() {
    const { text, renderOther, convoId } = this.props;
    const results: Array<any> = [];
    const FIND_MENTIONS = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');

    // We have to do this, because renderOther is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderOther) {
      return;
    }

    let match = FIND_MENTIONS.exec(text);
    let last = 0;
    let count = 1000;

    if (!match) {
      return renderOther({ text, key: 0 });
    }

    while (match) {
      count++;
      const key = count;
      if (last < match.index) {
        const otherText = text.slice(last, match.index);
        results.push(renderOther({ text: otherText, key }));
      }

      const pubkey = text.slice(match.index, FIND_MENTIONS.lastIndex);
      results.push(<Mention text={pubkey} key={`${key}`} convoId={convoId} />);

      last = FIND_MENTIONS.lastIndex;
      match = FIND_MENTIONS.exec(text);
    }

    if (last < text.length) {
      results.push(renderOther({ text: text.slice(last), key: count++ }));
    }

    return results;
  }
}
