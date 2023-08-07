import { last, orderBy } from 'lodash';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { PickEnum } from '../../../types/Enums';

export enum SnodeNamespaces {
  /**
   * This is the namespace anyone can deposit a message for us
   */
  UserMessages = 0,

  /**
   * This is the namespace used to sync our profile
   */
  UserProfile = 2,
  /**
   * This is the namespace used to sync our contacts
   */
  UserContacts = 3,
  /**
   * This is the namespace used to sync our volatile info (currently read status only)
   */
  ConvoInfoVolatile = 4,

  /**
   *  This is the namespace used to sync our user groups and communities
   */
  UserGroups = 5,

  /**
   * The messages sent to a closed group are sent and polled from this namespace
   */
  ClosedGroupMessage = -10,

  /**
   * This is the namespace used to sync the closed group details for each of the closed groups we are polling
   */
  // ClosedGroupInfo = 1,
}

export type SnodeNamespacesGroup = PickEnum<
  SnodeNamespaces,
  SnodeNamespaces.ClosedGroupMessage // | SnodeNamespaces.ClosedGroupInfo
>;

export type SnodeNamespacesUser = PickEnum<
  SnodeNamespaces,
  SnodeNamespaces.UserContacts | SnodeNamespaces.UserProfile | SnodeNamespaces.UserMessages
>;

/**
 * Returns true if that namespace is associated with the config of a user (not his messages, only configs)
 */
// eslint-disable-next-line consistent-return
function isUserConfigNamespace(namespace: SnodeNamespaces) {
  switch (namespace) {
    case SnodeNamespaces.UserMessages:
      // user messages is not hosting config based messages
      return false;
    case SnodeNamespaces.UserContacts:
    case SnodeNamespaces.UserProfile:
    case SnodeNamespaces.UserGroups:
    case SnodeNamespaces.ConvoInfoVolatile:
      return true;
    // case SnodeNamespaces.ClosedGroupInfo:
    case SnodeNamespaces.ClosedGroupMessage:
      return false;

    default:
      try {
        assertUnreachable(namespace, `isUserConfigNamespace case not handled: ${namespace}`);
      } catch (e) {
        window.log.warn(`isUserConfigNamespace case not handled: ${namespace}: ${e.message}`);
        return false;
      }
  }
}

// eslint-disable-next-line consistent-return
function namespacePriority(namespace: SnodeNamespaces): number {
  switch (namespace) {
    case SnodeNamespaces.UserMessages:
      return 10;
    case SnodeNamespaces.UserContacts:
      return 1;
    case SnodeNamespaces.UserProfile:
      return 1;
    case SnodeNamespaces.UserGroups:
      return 1;
    case SnodeNamespaces.ConvoInfoVolatile:
      return 1;
    case SnodeNamespaces.ClosedGroupMessage:
      return 10;

    default:
      try {
        assertUnreachable(namespace, `namespacePriority case not handled: ${namespace}`);
      } catch (e) {
        window.log.warn(`namespacePriority case not handled: ${namespace}: ${e.message}`);
        return 1;
      }
  }
}

function maxSizeMap(namespaces: Array<SnodeNamespaces>) {
  let lastSplit = 1;
  const withPriorities = namespaces.map(namespace => {
    return { namespace, priority: namespacePriority(namespace) };
  });
  const groupedByPriorities: Array<{ priority: number; namespaces: Array<SnodeNamespaces> }> = [];
  withPriorities.forEach(item => {
    if (!groupedByPriorities.find(p => p.priority === item.priority)) {
      groupedByPriorities.push({ priority: item.priority, namespaces: [] });
    }
    groupedByPriorities.find(p => p.priority === item.priority)?.namespaces.push(item.namespace);
  });

  const sortedDescPriorities = orderBy(groupedByPriorities, ['priority'], ['desc']);
  const lowestPriority = last(sortedDescPriorities)?.priority || 1;
  const sizeMap = sortedDescPriorities.flatMap(m => {
    const paddingForLowerPriority = m.priority === lowestPriority ? 0 : 1;
    const splitsForPriority = paddingForLowerPriority + m.namespaces.length;
    lastSplit *= splitsForPriority;
    return m.namespaces.map(namespace => ({ namespace, maxSize: -lastSplit }));
  });
  return sizeMap;
}

export const SnodeNamespace = {
  isUserConfigNamespace,
  maxSizeMap,
};
