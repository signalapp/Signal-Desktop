export function yo() {
  const worker = new Worker('./ts/webworker/workers/auth.worker.js', { type: 'module' });
  worker.postMessage({
    question: 'The Answer to the Ultimate Question of Life, The Universe, and Everything.',
  });
  worker.onmessage = ({ data: { answer } }) => {
    console.log(`The Answer to the Ultimate`, answer);
  };
  // const hashed = await auth.hashPassword('Super secret password', '1234');

  // console.log('Hashed password:', hashed);
}
