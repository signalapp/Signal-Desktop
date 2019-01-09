/* global dcodeIO, Plotly */
let jobId = 0;
let currentTrace = 0
let plotlyDiv;
const workers = [];
async function run(messageLength, numWorkers = 1, nonceTrials=100) {
  const timestamp = Math.floor(Date.now() / 1000);
  const ttl = 4 * 24 * 60 * 60;
  const pubKey = '05ec8635a07a13743516c7c9b3412f3e8252efb7fcaf67eb1615ffba62bebc6802';
  const message = randomString(messageLength);
  const messageBuffer = dcodeIO.ByteBuffer.wrap(message, 'utf8').toArrayBuffer();
  const data = dcodeIO.ByteBuffer.wrap(messageBuffer).toString('base64');
  const promises = [];
  const t0 = performance.now();
  for (let w = 0; w < numWorkers; w += 1) {
    const worker = new Worker('../../js/util_worker.js');
    workers.push(worker);
    jobId += 1;
    const increment = numWorkers;
    const index = w;
    worker.postMessage([jobId, 'calcPoW', timestamp, ttl, pubKey, data, false, nonceTrials, increment, index]);
    const p = new Promise(resolve => {
      worker.onmessage = (nonce) => {
        resolve(nonce);
      };
    });
    promises.push(p);
  }
  await Promise.race(promises);
  const t1 = performance.now();
  const duration = (t1 - t0) / 1000;
  addPoint(duration);
  // clean up
  workers.forEach(worker => worker.terminate());
}

async function runPoW({ iteration, nonceTrials, numWorkers, messageLength = 50 }) {
  const name = `W:${numWorkers} - NT: ${nonceTrials} - L:${messageLength}`;
  Plotly.addTraces(plotlyDiv ,{
    y: [],
    type: 'box',
    boxpoints: 'all',
    name,
  });
  for (let i = 0; i < iteration; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await run(messageLength, numWorkers, nonceTrials);
  }
  currentTrace += 1;
  console.log(`done for ${name}`);
}


function randomString(length) {
  let text = '';
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i += 1)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

function addPoint(duration) {
  Plotly.extendTraces(plotlyDiv, {y: [[duration]]}, [currentTrace]);
}
async function startMessageLengthRun() {
  const iteration0 = parseFloat(document.getElementById('iteration0').value);
  const nonceTrials0 = parseFloat(document.getElementById('nonceTrials0').value);
  const numWorkers0 = parseFloat(document.getElementById('numWorkers0').value);
  const messageLengthStart0 = parseFloat(document.getElementById('messageLengthStart0').value);
  const messageLengthStop0 = parseFloat(document.getElementById('messageLengthStop0').value);
  const messageLengthStep0 = parseFloat(document.getElementById('messageLengthStep0').value);
  for (let l = messageLengthStart0; l < messageLengthStop0; l += messageLengthStep0) {
    // eslint-disable-next-line no-await-in-loop
    await runPoW({ iteration: iteration0, nonceTrials: nonceTrials0, numWorkers: numWorkers0, messageLength: l });
  }
}
async function startNumWorkerRun() {
  const iteration1 = parseFloat(document.getElementById('iteration1').value);
  const nonceTrials1 = parseFloat(document.getElementById('nonceTrials1').value);
  const numWorkersStart1 = parseFloat(document.getElementById('numWorkersStart1').value);
  const numWorkersEnd1 = parseFloat(document.getElementById('numWorkersEnd1').value);
  const messageLength1 = parseFloat(document.getElementById('messageLength1').value);
  for (let numWorkers = numWorkersStart1; numWorkers <= numWorkersEnd1; numWorkers +=1) {
    // eslint-disable-next-line no-await-in-loop
    await runPoW({ iteration: iteration1, nonceTrials: nonceTrials1, numWorkers, messageLength: messageLength1 });
  }
}
async function startNonceTrialsRun() {
  const iteration2 = parseFloat(document.getElementById('iteration2').value);
  const messageLength2 = parseFloat(document.getElementById('messageLength2').value);
  const numWorkers2 = parseFloat(document.getElementById('numWorkers2').value);
  const nonceTrialsStart2 = parseFloat(document.getElementById('nonceTrialsStart2').value);
  const nonceTrialsStop2 = parseFloat(document.getElementById('nonceTrialsStop2').value);
  const nonceTrialsStep2 = parseFloat(document.getElementById('nonceTrialsStep2').value);
  for (let n = nonceTrialsStart2; n < nonceTrialsStop2; n += nonceTrialsStep2) {
    // eslint-disable-next-line no-await-in-loop
    await runPoW({ iteration: iteration2, nonceTrials: n, numWorkers: numWorkers2, messageLength: messageLength2 });
  }
}
async function start(index) {
  const data = [];
  const layout = {};
  const options = {
    responsive: true,
  };
  plotlyDiv =`plotly${index}`;
  currentTrace = 0;
  window.chart = Plotly.newPlot(plotlyDiv, data, layout, options);
  workers.forEach(worker => worker.terminate());

  switch(index) {
    case 0:
      await startMessageLengthRun();
      break;
    case 1:
      await startNumWorkerRun();
      break;
    case 2:
      await startNonceTrialsRun();
      break;
    default:
      break;
  }
}
