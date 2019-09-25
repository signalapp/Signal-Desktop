import React from 'react';

import { RenderTextCallbackType } from '../../types/Util';
import classNames from 'classnames';

declare global {
  interface Window {
    lokiPublicChatAPI: any;
    shortenPubkey: any;
    pubkeyPattern: any;
  }
}

interface MentionProps {
  key: number;
  text: string;
}

interface MentionState {
  found: any;
}

class Mention extends React.Component<MentionProps, MentionState> {
  private intervalHandle: any = null;
  constructor(props: any) {
    super(props);

    this.tryRenameMention = this.tryRenameMention.bind(this);
  }

  public componentWillMount() {
    const found = this.findMember(this.props.text.slice(1));
    this.setState({ found });

    this.tryRenameMention();
    // TODO: give up after some period of time?
    this.intervalHandle = setInterval(this.tryRenameMention, 30000);
  }

  public componentWillUnmount() {
    this.clearOurInterval();
  }

  public render() {
    if (this.state.found) {
      // TODO: We don't have to search the database of message just to know that the message is for us!
      const us =
        this.state.found.authorPhoneNumber === window.lokiPublicChatAPI.ourKey;
      const className = classNames(
        'mention-profile-name',
        us && 'mention-profile-name-us'
      );

      const profileName = this.state.found.authorProfileName;
      const displayedName =
        profileName && profileName.length > 0 ? profileName : 'Anonymous';

      return <span className={className}>{displayedName}</span>;
    } else {
      return (
        <span className="mention-profile-name">
          {window.shortenPubkey(this.props.text)}
        </span>
      );
    }
  }

  private clearOurInterval() {
    clearInterval(this.intervalHandle);
  }

  private tryRenameMention() {
    const found = this.findMember(this.props.text.slice(1));
    if (found) {
      this.setState({ found });
      this.clearOurInterval();
    }
  }

  private findMember(pubkey: String) {
    const members = window.lokiPublicChatAPI.getListOfMembers();
    if (!members) {
      return null;
    }
    const filtered = members.filter((m: any) => !!m);

    return filtered.find(
      ({ authorPhoneNumber: pn }: any) => pn && pn === pubkey
    );
  }
}

interface Props {
  text: string;
  renderOther?: RenderTextCallbackType;
}

export class AddMentions extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderOther: ({ text }) => text,
  };

  public render() {
    const { text, renderOther } = this.props;
    const results: Array<any> = [];
    const FIND_MENTIONS = window.pubkeyPattern;

    // We have to do this, because renderNonNewLine is not required in our Props object,
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
      if (last < match.index) {
        const otherText = text.slice(last, match.index);
        results.push(renderOther({ text: otherText, key: count++ }));
      }

      const pubkey = text.slice(match.index, FIND_MENTIONS.lastIndex);
      results.push(<Mention text={pubkey} key={count++} />);

      // @ts-ignore
      last = FIND_MENTIONS.lastIndex;
      match = FIND_MENTIONS.exec(text);
    }

    if (last < text.length) {
      results.push(renderOther({ text: text.slice(last), key: count++ }));
    }

    return results;
  }
}
