import React from 'react';

interface Props {}

interface State {
  // FIXME Use Emoji-Mart categories
  category: null;
}

export class SessionEmojiPanel extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      category: null,
    };
  }

  render() {
    return <div className="session-emoji-panel">THIS IS EMOJI STUFF</div>;
  }
}
