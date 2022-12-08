import { BaseConfigWrapper } from 'session_util_wrapper';

type UserConfig = 'UserConfig'; // we can only have one of those wrapper for our current user (but we can have a few configs for it to be merged into one)
type ClosedGroupConfigPrefix = 'ClosedGroupConfig-'; // we can have a bunch of those wrapper as we need to be able to send them to a different swarm for each group
type ClosedGroupConfig = `${ClosedGroupConfigPrefix}${string}`;

export type ConfigWrapperObjectTypes = UserConfig | ClosedGroupConfig;

type BaseConfigActions = ['needsDump'] | ['needsPush'] | ['push', Uint8Array, number] | ['dump']

/**Those are the actions inherited from BaseConfigWrapper to UserConfigWrapper */
type UserConfigInheritedActions = [UserConfig, ...BaseConfigActions];
type UserConfigActions = [UserConfig, 'getName'] | [UserConfig, 'setName', string|null];

/**Those are the actions inherited from BaseConfigWrapper to ClosedGroupConfigWrapper */
type ClosedGroupConfigFromBase = [ClosedGroupConfig, ...BaseConfigActions];


type UserConfigFunctions = UserConfigInheritedActions | UserConfigActions;
type ClosedGroupConfigFunctions = ClosedGroupConfigFromBase;

export type LibSessionWorkerFunctions = UserConfigFunctions | ClosedGroupConfigFunctions;
