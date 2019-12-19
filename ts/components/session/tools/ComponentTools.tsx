// This is a collection of tools which can be ued to simplify the esign and rendering process of your components.

export function generateID() {
  // Generates a unique ID for your component
  const buffer = new Uint32Array(10);

  return window.crypto.getRandomValues(buffer)[0].toString();
}
