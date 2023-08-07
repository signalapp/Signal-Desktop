export function trigger(name: string, param1?: any, param2?: any) {
  window.Whisper.events.trigger(name, param1, param2);
}

export const configurationMessageReceived = 'configurationMessageReceived';
export const ConfigurationSyncJobDone = 'ConfigurationSyncJobDone';
