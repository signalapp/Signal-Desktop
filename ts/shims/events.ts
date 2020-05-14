export function trigger(name: string, param1?: any, param2?: any) {
  window.Whisper.events.trigger(name, param1, param2);
}
