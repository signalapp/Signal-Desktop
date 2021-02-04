// this is not a very good name, but a configuration message is a message sent to our other devices so sync our current public and closed groups

import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';
import { Constants } from '../../..';
import { ECKeyPair } from '../../../../receiver/keypairs';
import { fromHexToArray } from '../../../utils/String';

interface ConfigurationMessageParams extends MessageParams {
  activeClosedGroups: Array<ConfigurationMessageClosedGroup>;
  activeOpenGroups: Array<string>;
}

export class ConfigurationMessage extends ContentMessage {
  private readonly activeClosedGroups: Array<ConfigurationMessageClosedGroup>;
  private readonly activeOpenGroups: Array<string>;

  constructor(params: ConfigurationMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.activeClosedGroups = params.activeClosedGroups;
    this.activeOpenGroups = params.activeOpenGroups;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.TYPING_MESSAGE;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      configurationMessage: this.configurationProto(),
    });
  }

  protected configurationProto(): SignalService.ConfigurationMessage {
    return new SignalService.ConfigurationMessage({
      closedGroups: this.mapClosedGroupsObjectToProto(this.activeClosedGroups),
      openGroups: this.activeOpenGroups,
    });
  }

  private mapClosedGroupsObjectToProto(
    closedGroups: Array<ConfigurationMessageClosedGroup>
  ): Array<SignalService.ConfigurationMessage.ClosedGroup> {
    return (closedGroups || []).map(m =>
      new ConfigurationMessageClosedGroup(m).toProto()
    );
  }
}

export class ConfigurationMessageClosedGroup {
  public publicKey: string;
  public name: string;
  public encryptionKeyPair: ECKeyPair;
  public members: Array<string>;
  public admins: Array<string>;

  public constructor({
    publicKey,
    name,
    encryptionKeyPair,
    members,
    admins,
  }: {
    publicKey: string;
    name: string;
    encryptionKeyPair: ECKeyPair;
    members: Array<string>;
    admins: Array<string>;
  }) {
    this.publicKey = publicKey;
    this.name = name;
    this.encryptionKeyPair = encryptionKeyPair;
    this.members = members;
    this.admins = admins;
  }

  public toProto(): SignalService.ConfigurationMessage.ClosedGroup {
    return new SignalService.ConfigurationMessage.ClosedGroup({
      publicKey: fromHexToArray(this.publicKey),
      name: this.name,
      encryptionKeyPair: {
        publicKey: this.encryptionKeyPair.publicKeyData,
        privateKey: this.encryptionKeyPair.privateKeyData,
      },
      members: this.members.map(fromHexToArray),
      admins: this.admins.map(fromHexToArray),
    });
  }
}
