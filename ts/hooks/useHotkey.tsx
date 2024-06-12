import useKey, { Handler, KeyPredicate, UseKeyOptions } from 'react-use/lib/useKey';

function specialKeyPressed(event: KeyboardEvent) {
  const pressed = [];

  if (event.metaKey) {
    pressed.push('super');
  }
  if (event.ctrlKey) {
    pressed.push('ctrl');
  }
  if (event.altKey) {
    pressed.push('alt');
  }
  if (event.shiftKey) {
    pressed.push('shift');
  }

  return pressed.join(' + ');
}

export function useHotkey(
  key: string,
  onPress: (event: KeyboardEvent) => void | Promise<void>,
  disabled?: boolean
) {
  const opts: UseKeyOptions<HTMLElement> = {};

  const predicate: KeyPredicate = event => {
    const lowerKey = key.toLowerCase();
    const eventKey = event.key.toLowerCase();

    window.log.debug(
      `WIP: [useHotkey] key: ${key} lowerKey: ${lowerKey} eventKey: ${eventKey} event.target: ${JSON.stringify(event)}`
    );

    switch (lowerKey) {
      case 'esc':
      case 'escape':
        return eventKey === 'escape' || eventKey === 'esc';
      default:
        return eventKey === lowerKey;
    }
  };

  const handler: Handler = event => {
    if (disabled) {
      window.log.debug(`WIP: [useHotkey] '${key}' is disabled. Triggered by ${event.key}`);
      return;
    }

    const specialKeys = specialKeyPressed(event);

    if (specialKeys) {
      window.log.debug(
        `WIP: [useHotkey] '${key}' was ignored because it was pressed with ${specialKeys}. Triggered by ${event.key} + ${specialKeys}`
      );
      return;
    }

    window.log.debug(`WIP: [useHotkey] '${key}' onPress event. Triggered by ${event.key}`);
    void onPress(event);
  };

  useKey(predicate, handler, opts);
}
