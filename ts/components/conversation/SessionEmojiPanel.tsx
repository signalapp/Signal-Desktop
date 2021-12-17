import React from 'react';
import classNames from 'classnames';
import { Picker } from 'emoji-mart';
import { Constants } from '../../session';

type Props = {
  onEmojiClicked: (emoji: any) => void;
  show: boolean;
};

export const SessionEmojiPanel = (props: Props) => {
  const { onEmojiClicked, show } = props;

  return (
    <div className={classNames('session-emoji-panel', show && 'show')}>
      <Picker
        backgroundImageFn={() => './images/emoji/emoji-sheet-twitter-32.png'}
        set={'twitter'}
        sheetSize={32}
        darkMode={true}
        color={Constants.UI.COLORS.GREEN}
        showPreview={true}
        title={''}
        onSelect={onEmojiClicked}
        autoFocus={true}
      />
    </div>
  );
};
