export function getEventSogsFirstPoll(serverpubkey: string, roomId: string) {
  return `first-poll-sogs:${roomId}-${serverpubkey}`;
}
