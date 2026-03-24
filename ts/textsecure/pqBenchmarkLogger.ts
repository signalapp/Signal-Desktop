import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { PQ_ENABLED } from './PQWrapper';

const BENCH_ENABLED = true;

// Where logs go (macOS-safe)
const BENCH_DIR = '/Users/somthin/SignalPQBenchmarks';
function getBenchFile() {
  return join(
    BENCH_DIR,
    PQ_ENABLED ? 'pq_bench_pq.log' : 'pq_bench_plain.log'
  );
}


type BenchRecord = {
  ts: number;                 // Date.now()
  side: 'send' | 'recv';
  stage: string;              // e.g. PQ_SEND, SEND_PREP, SIGNAL_SEND
  serviceId?: string;
  values: Record<string, number | string | boolean>;
};

let dirReady = false;

async function ensureDir() {
  if (!dirReady) {
    await mkdir(BENCH_DIR, { recursive: true });
    dirReady = true;
  }
}

export async function benchLog(record: BenchRecord) {
  if (!BENCH_ENABLED) return;

  try {
    await ensureDir();
    await appendFile(
      getBenchFile(),
      JSON.stringify(record) + '\n',
      'utf8'
    );

  } catch {
    // Benchmarking must never break messaging
  }
}
