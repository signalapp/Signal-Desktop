import { shell } from 'electron';
import { SessionIconButton, SessionIconSize } from '../icon';
import { SessionIconButtonProps } from '../icon/SessionIconButton';

export const HelpDeskButton = (
  props: Omit<SessionIconButtonProps, 'iconType' | 'iconSize'> & { iconSize?: SessionIconSize }
) => {
  return (
    <SessionIconButton
      aria-label="Help desk link"
      {...props}
      iconType="question"
      iconSize={props.iconSize || 10}
      iconPadding={props.iconPadding || '2px'}
      padding={props.padding || '0'}
      dataTestId="session-link-helpdesk"
      onClick={() => {
        void shell.openExternal(
          'https://sessionapp.zendesk.com/hc/en-us/articles/4439132747033-How-do-Session-ID-usernames-work'
        );
      }}
    />
  );
};
