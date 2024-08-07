import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';

type Props = {
  onClick: () => void | Promise<void>;
  disabled: boolean;
};

export const ContinueButton = (props: Props) => {
  const { onClick, disabled } = props;

  return (
    <SessionButton
      ariaLabel={window.i18n('continue')}
      buttonColor={SessionButtonColor.White}
      onClick={onClick}
      text={window.i18n('continue')}
      disabled={disabled}
      dataTestId="continue-button"
    />
  );
};
