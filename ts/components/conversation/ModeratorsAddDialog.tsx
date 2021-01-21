import React from 'react';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../session/SessionButton';
import { PubKey } from '../../session/types';
import { ConversationModel } from '../../../js/models/conversations';
import { ToastUtils } from '../../session/utils';
import { SessionModal } from '../session/SessionModal';
import { DefaultTheme } from 'styled-components';
import { SessionSpinner } from '../session/SessionSpinner';
import { Flex } from '../session/Flex';
interface Props {
  convo: ConversationModel;
  onClose: any;
  theme: DefaultTheme;
}

interface State {
  inputBoxValue: string;
  addingInProgress: boolean;
  firstLoading: boolean;
}

export class AddModeratorsDialog extends React.Component<Props, State> {
  private channelAPI: any;

  constructor(props: Props) {
    super(props);

    this.addAsModerator = this.addAsModerator.bind(this);
    this.onPubkeyBoxChanges = this.onPubkeyBoxChanges.bind(this);

    this.state = {
      inputBoxValue: '',
      addingInProgress: false,
      firstLoading: true,
    };
  }

  public async componentDidMount() {
    this.channelAPI = await this.props.convo.getPublicSendData();

    this.setState({ firstLoading: false });
  }

  public async addAsModerator() {
    // if we don't have valid data entered by the user
    const pubkey = PubKey.from(this.state.inputBoxValue);
    if (!pubkey) {
      window.log.info(
        'invalid pubkey for adding as moderator:',
        this.state.inputBoxValue
      );
      ToastUtils.pushInvalidPubKey();
      return;
    }

    window.log.info(`asked to add moderator: ${pubkey.key}`);

    try {
      this.setState({
        addingInProgress: true,
      });
      const res = await this.channelAPI.serverAPI.addModerator([pubkey.key]);
      if (!res) {
        window.log.warn('failed to add moderators:', res);

        ToastUtils.pushUserNeedsToHaveJoined();
      } else {
        window.log.info(`${pubkey.key} added as moderator...`);
        ToastUtils.pushUserAddedToModerators();

        // clear input box
        this.setState({
          inputBoxValue: '',
        });
      }
    } catch (e) {
      window.log.error('Got error while adding moderator:', e);
    } finally {
      this.setState({
        addingInProgress: false,
      });
    }
  }

  public render() {
    const { i18n } = window;
    const { addingInProgress, inputBoxValue, firstLoading } = this.state;
    const chatName = this.props.convo.get('name');

    const title = `${i18n('addModerators')}: ${chatName}`;

    const renderContent = !firstLoading;

    return (
      <SessionModal
        title={title}
        onClose={() => this.props.onClose()}
        theme={this.props.theme}
      >
        <Flex container={true} flexDirection="column" alignItems="center">
          {renderContent && (
            <>
              <p>Add Moderator:</p>
              <input
                type="text"
                className="module-main-header__search__input"
                placeholder={i18n('enterSessionID')}
                dir="auto"
                onChange={this.onPubkeyBoxChanges}
                disabled={addingInProgress}
                value={inputBoxValue}
              />
              <SessionButton
                buttonType={SessionButtonType.Brand}
                buttonColor={SessionButtonColor.Primary}
                onClick={this.addAsModerator}
                text={i18n('add')}
                disabled={addingInProgress}
              />
            </>
          )}
          <SessionSpinner loading={addingInProgress || firstLoading} />
        </Flex>
      </SessionModal>
    );
  }

  private onPubkeyBoxChanges(e: any) {
    const val = e.target.value;
    this.setState({ inputBoxValue: val });
  }
}
