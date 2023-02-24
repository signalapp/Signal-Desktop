import {
  BaseConfigActions,
  ContactsConfigActionsType,
  UserConfigActionsType,
  UserGroupsConfigActionsType,
} from 'session_util_wrapper';

type UserConfig = 'UserConfig'; // we can only have one of those wrapper for our current user (but we can have a few configs for it to be merged into one)
type ContactsConfig = 'ContactsConfig';
type UserGroupsConfig = 'UserGroupsConfig';

// type ClosedGroupConfigPrefix = 'ClosedGroupConfig-03'; // we can have a bunch of those wrapper as we need to be able to send them to a different swarm for each group
// type ClosedGroupConfig = `${ClosedGroupConfigPrefix}${string}`;
// | ClosedGroupConfig;
export type ConfigWrapperObjectTypes = UserConfig | ContactsConfig | UserGroupsConfig;

type UserConfigFunctions =
  | [UserConfig, ...BaseConfigActions]
  | [UserConfig, ...UserConfigActionsType];
type ContactsConfigFunctions =
  | [ContactsConfig, ...BaseConfigActions]
  | [ContactsConfig, ...ContactsConfigActionsType];

type UserGroupsConfigFunctions =
  | [UserGroupsConfig, ...BaseConfigActions]
  | [UserGroupsConfig, ...UserGroupsConfigActionsType];

export type LibSessionWorkerFunctions =
  | UserConfigFunctions
  | ContactsConfigFunctions
  | UserGroupsConfigFunctions;
