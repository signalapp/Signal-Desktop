import {
  BaseConfigActions,
  ContactsConfigActionsType,
  ConvoInfoVolatileConfigActionsType,
  UserConfigActionsType,
  UserGroupsConfigActionsType,
} from 'libsession_util_nodejs';

// we can only have one of those wrapper for our current user (but we can have a few configs for it to be merged into one)
type UserConfig = 'UserConfig';
type ContactsConfig = 'ContactsConfig';
type UserGroupsConfig = 'UserGroupsConfig';
type ConvoInfoVolatileConfig = 'ConvoInfoVolatileConfig';

export type ConfigWrapperObjectTypes =
  | UserConfig
  | ContactsConfig
  | UserGroupsConfig
  | ConvoInfoVolatileConfig;

type UserConfigFunctions =
  | [UserConfig, ...BaseConfigActions]
  | [UserConfig, ...UserConfigActionsType];
type ContactsConfigFunctions =
  | [ContactsConfig, ...BaseConfigActions]
  | [ContactsConfig, ...ContactsConfigActionsType];
type UserGroupsConfigFunctions =
  | [UserGroupsConfig, ...BaseConfigActions]
  | [UserGroupsConfig, ...UserGroupsConfigActionsType];
type ConvoInfoVolatileConfigFunctions =
  | [ConvoInfoVolatileConfig, ...BaseConfigActions]
  | [ConvoInfoVolatileConfig, ...ConvoInfoVolatileConfigActionsType];
type BlindingFunctions = ['Blinding', ...BlindingFunctions];

export type LibSessionWorkerFunctions =
  | UserConfigFunctions
  | ContactsConfigFunctions
  | UserGroupsConfigFunctions
  | ConvoInfoVolatileConfigFunctions
  | BlindingFunctions;
