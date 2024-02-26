import { SpacerLG } from '../basic/Text';
import { SessionInput2 } from '../inputs';

const RecoveryPhraseInput = (props: {
  recoveryPhrase: string;
  onSeedChanged: (val: string) => any;
  handlePressEnter: () => any;
  stealAutoFocus?: boolean;
}) => {
  return (
    <SessionInput2
      type="password"
      value={props.recoveryPhrase}
      autoFocus={props.stealAutoFocus || false}
      placeholder={window.i18n('enterRecoveryPhrase')}
      enableShowHide={true}
      onValueChanged={props.onSeedChanged}
      onEnterPressed={props.handlePressEnter}
      inputDataTestId="recovery-phrase-input"
    />
  );
};

export interface Props {
  showDisplayNameField: boolean;
  showSeedField: boolean;
  stealAutoFocus?: boolean;
  recoveryPhrase?: string;
  displayName: string;
  handlePressEnter: () => any;
  onSeedChanged?: (val: string) => any;
  onDisplayNameChanged: (val: string) => any;
}

export const RegistrationUserDetails = (props: Props) => {
  if (props.showSeedField && (props.recoveryPhrase === undefined || !props.onSeedChanged)) {
    throw new Error('if show seed is true, we need callback + value');
  }

  return (
    <div style={{ margin: 0 }}>
      {props.showSeedField && (
        <>
          <RecoveryPhraseInput
            recoveryPhrase={props.recoveryPhrase as string}
            handlePressEnter={props.handlePressEnter}
            onSeedChanged={props.onSeedChanged as any}
            stealAutoFocus={props.stealAutoFocus}
          />
          <SpacerLG />
        </>
      )}
    </div>
  );
};
