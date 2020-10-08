import React from 'react';
import * as _ from 'lodash';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { UserUtil } from '../../util';
import { MultiDeviceProtocol } from '../../session/protocols';
import { PubKey } from '../../session/types';
import { ConversationModel } from '../../../js/models/conversations';
import { SessionSpinner } from './SessionSpinner';
import classNames from 'classnames';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { Constants } from '../../session';

interface Props {
  conversation: ConversationModel;
}

interface State {
  loading: boolean;
  error?: 'verificationKeysLoadFail';
  securityNumber?: string;
  isVerified?: boolean;
}

export class SessionKeyVerification extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      loading: true,
      error: undefined,
      securityNumber: undefined,
      isVerified: this.props.conversation.isVerified(),
    };

    this.toggleVerification = this.toggleVerification.bind(this);
    this.onSafetyNumberChanged = this.onSafetyNumberChanged.bind(this);
  }

  public async componentWillMount() {
    const securityNumber = await this.generateSecurityNumber();

    if (!securityNumber) {
      this.setState({
        error: 'verificationKeysLoadFail',
      });
      return;
    }

    // Finished loading
    this.setState({
      loading: false,
      securityNumber,
    });
  }

  public render() {
    const theirName = this.props.conversation.attributes.profileName;
    const theirPubkey = this.props.conversation.id;
    const isVerified = this.props.conversation.isVerified();

    if (this.state.loading) {
      return (
        <div className="key-verification">
          <SessionSpinner loading={this.state.loading} />
        </div>
      );
    }

    const verificationIconColor = isVerified
      ? Constants.UI.COLORS.GREEN
      : Constants.UI.COLORS.DANGER;
    const verificationButtonColor = isVerified
      ? SessionButtonColor.Warning
      : SessionButtonColor.Success;
    const verificationButton = (
      <SessionButton
        buttonType={SessionButtonType.DefaultOutline}
        buttonColor={verificationButtonColor}
        onClick={this.toggleVerification}
      >
        {window.i18n(isVerified ? 'unverify' : 'verify')}
      </SessionButton>
    );

    return (
      <div className="key-verification">
        {this.state.error ? (
          <h3>{window.i18n(this.state.error)}</h3>
        ) : (
          <>
            <div className={classNames('key-verification__header')}>
              <h2>{window.i18n('safetyNumber')}</h2>
              <small>{theirPubkey}</small>
            </div>

            <div
              className={classNames(
                'key-verification__key',
                'session-info-box'
              )}
            >
              {this.renderSecurityNumber()}
            </div>

            <div className="key-verification__help">
              {window.i18n('verifyHelp', theirName)}
            </div>

            <div className="key-verification__is-verified">
              <span>
                <SessionIcon
                  iconType={SessionIconType.Lock}
                  iconSize={SessionIconSize.Huge}
                  iconColor={verificationIconColor}
                />
                {window.i18n(
                  isVerified ? 'isVerified' : 'isNotVerified',
                  theirName
                )}
              </span>

              {verificationButton}
            </div>
          </>
        )}
      </div>
    );
  }

  public async onSafetyNumberChanged() {
    const conversationModel = this.props.conversation;
    await conversationModel.getProfiles();

    const securityNumber = await this.generateSecurityNumber();
    this.setState({ securityNumber });

    window.confirmationDialog({
      title: window.i18n('changedSinceVerifiedTitle'),
      message: window.i18n('changedRightAfterVerify', [
        conversationModel.attributes.profileName,
        conversationModel.attributes.profileName,
      ]),
      hideCancel: true,
    });
  }

  private async generateSecurityNumber(): Promise<string | undefined> {
    const ourDeviceKey = await UserUtil.getCurrentDevicePubKey();

    if (!ourDeviceKey) {
      this.setState({
        error: 'verificationKeysLoadFail',
      });
      return;
    }

    const conversationId = this.props.conversation.id;
    const ourPrimaryKey = (
      await MultiDeviceProtocol.getPrimaryDevice(PubKey.cast(ourDeviceKey))
    ).key;

    // Grab identity keys
    const ourIdentityKey = await window.textsecure.storage.protocol.loadIdentityKey(
      ourPrimaryKey
    );
    const theirIdentityKey = await window.textsecure.storage.protocol.loadIdentityKey(
      this.props.conversation.id
    );

    if (!ourIdentityKey || !theirIdentityKey) {
      return;
    }

    // Generate security number
    const fingerprintGenerator = new window.libsignal.FingerprintGenerator(
      5200
    );
    return fingerprintGenerator.createFor(
      ourPrimaryKey,
      ourIdentityKey,
      conversationId,
      theirIdentityKey
    );
  }

  private async toggleVerification() {
    const conversationModel = this.props.conversation;

    try {
      await conversationModel.toggleVerified();
      this.setState({ isVerified: !this.state.isVerified });

      await conversationModel.getProfiles();
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'OutgoingIdentityKeyError') {
          await this.onSafetyNumberChanged();
        } else {
          window.log.error(
            'failed to toggle verified:',
            e && e.stack ? e.stack : e
          );
        }
      } else {
        const keyError = _.some(
          e.errors,
          error => error.name === 'OutgoingIdentityKeyError'
        );
        if (keyError) {
          await this.onSafetyNumberChanged();
        } else {
          _.forEach(e.errors, error => {
            window.log.error(
              'failed to toggle verified:',
              error && error.stack ? error.stack : error
            );
          });
        }
      }
    }
  }

  private renderSecurityNumber(): Array<JSX.Element> | undefined {
    // Turns  32813902154726601686003948952478 ...
    // into   32813 90215 47266 ...
    const { loading, securityNumber } = this.state;

    if (loading) {
      return;
    }

    const securityNumberChunks = _.chunk(
      Array.from(securityNumber ?? []),
      5
    ).map(chunk => chunk.join(''));
    const securityNumberLines = _.chunk(securityNumberChunks, 4).map(chunk =>
      chunk.join(' ')
    );

    const securityNumberElement = securityNumberLines.map(line => (
      <div key={line}>{line}</div>
    ));
    return securityNumberElement;
  }
}
