export enum SnodeNamespaces {
  /**
   * The messages sent to a closed group are sent and polled from this namespace
   */
  ClosedGroupMessages = -10,

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
   * This is the namespace used to sync the closed group details for each of the closed groups we are polling
   */
  ClosedGroupInfo = 11,
}
