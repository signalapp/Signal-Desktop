import { MAX_USERNAME_BYTES } from '../../session/constants';
import { SpacerLG } from '../basic/Text';
import { SessionInput2 } from '../inputs';
import { BackButtonWithininContainer } from './components/BackButton';

const DisplayNameInput = (props: {
  stealAutoFocus?: boolean;
  displayName: string;
  onDisplayNameChanged: (val: string) => any;
  handlePressEnter: () => any;
}) => {
  return (
    <SessionInput2
      autoFocus={props.stealAutoFocus || false}
      type="text"
      placeholder={window.i18n('enterDisplayName')}
      value={props.displayName}
      maxLength={MAX_USERNAME_BYTES}
      onValueChanged={props.onDisplayNameChanged}
      onEnterPressed={props.handlePressEnter}
      inputDataTestId="display-name-input"
    />
  );
};

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
    <BackButtonWithininContainer margin={'12px 0 0 0'}>
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
        {props.showDisplayNameField && (
          <>
            <DisplayNameInput
              stealAutoFocus={!props.showSeedField && props.stealAutoFocus}
              displayName={props.displayName}
              handlePressEnter={props.handlePressEnter}
              onDisplayNameChanged={props.onDisplayNameChanged}
            />
            <SpacerLG />
          </>
        )}
      </div>
    </BackButtonWithininContainer>
  );
};
