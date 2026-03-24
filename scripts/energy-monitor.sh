#!/bin/bash
# energy-monitor.sh — Monitor Signal Desktop energy/CPU usage
# Usage: ./scripts/energy-monitor.sh [pq|nopq] [duration_seconds]
#
# Aggregates ALL Signal/Electron processes (main, renderer, GPU, network)
# Output: CSV file in ~/SignalEnergyLogs/

MODE="${1:-pq}"
DURATION="${2:-120}"
LOG_DIR="$HOME/SignalEnergyLogs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/energy_${MODE}_${TIMESTAMP}.csv"

mkdir -p "$LOG_DIR"

# Find ALL Signal Electron processes
PIDS=$(ps aux | grep -i "electron" | grep -i "Signal" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
  echo "Signal is not running. Start it first."
  exit 1
fi

PID_COUNT=$(echo "$PIDS" | wc -l | tr -d ' ')
PID_LIST=$(echo "$PIDS" | tr '\n' ',' | sed 's/,$//')

echo "Found $PID_COUNT Signal processes (PIDs: $PID_LIST)"
echo "Monitoring for ${DURATION}s in ${MODE} mode"
echo "Logging to: $LOG_FILE"
echo ""

# CSV header
echo "timestamp,elapsed_s,total_cpu_percent,total_memory_rss_mb,process_count" > "$LOG_FILE"

# Prevent sleep during monitoring
caffeinate -i -w $$ &
CAFE_PID=$!

START_TIME=$(date +%s)
ELAPSED=0

while [ "$ELAPSED" -lt "$DURATION" ]; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TIME))

  # Sum CPU% and RSS across ALL Signal/Electron processes
  STATS=$(ps aux | grep -i "electron" | grep -i "Signal" | grep -v grep | awk '{
    cpu += $3;
    rss += $6;
    count++;
  } END {
    printf "%.1f %d %d", cpu, rss, count
  }')

  if [ -z "$STATS" ] || [ "$(echo "$STATS" | awk '{print $3}')" = "0" ]; then
    echo "Signal processes ended."
    break
  fi

  TOTAL_CPU=$(echo "$STATS" | awk '{print $1}')
  TOTAL_RSS_KB=$(echo "$STATS" | awk '{print $2}')
  TOTAL_RSS_MB=$(echo "scale=1; $TOTAL_RSS_KB / 1024" | bc)
  PROC_COUNT=$(echo "$STATS" | awk '{print $3}')
  TS=$(date +%H:%M:%S)

  echo "$TS,$ELAPSED,$TOTAL_CPU,$TOTAL_RSS_MB,$PROC_COUNT" >> "$LOG_FILE"

  # Print live
  printf "\r[%s] elapsed: %3ds | CPU: %6s%% | RAM: %8s MB | procs: %s   " \
    "$TS" "$ELAPSED" "$TOTAL_CPU" "$TOTAL_RSS_MB" "$PROC_COUNT"

  sleep 1
done

echo ""
echo ""
echo "Done. Log saved to: $LOG_FILE"

# Summary
SUMMARY_FILE="$LOG_DIR/summary_${MODE}_${TIMESTAMP}.txt"
{
  echo "=== Signal Energy Monitor Summary ==="
  echo "Mode: $MODE"
  echo "Duration: ${ELAPSED}s"
  echo "Date: $(date)"
  echo "Processes: $PID_COUNT"
  echo ""
  echo "--- Total CPU% (all Signal processes) ---"
  awk -F',' 'NR>1 {sum+=$3; if($3>max)max=$3; if(min==""||$3<min)min=$3; count++} END {
    printf "  Average: %.1f%%\n", sum/count;
    printf "  Peak:    %.1f%%\n", max;
    printf "  Min:     %.1f%%\n", min;
    printf "  Samples: %d\n", count
  }' "$LOG_FILE"
  echo ""
  echo "--- Total Memory (all Signal processes) ---"
  awk -F',' 'NR>1 {sum+=$4; if($4>max)max=$4; if(min==""||$4<min)min=$4; count++} END {
    printf "  Average: %.1f MB\n", sum/count;
    printf "  Peak:    %.1f MB\n", max;
    printf "  Min:     %.1f MB\n", min
  }' "$LOG_FILE"
} > "$SUMMARY_FILE"

echo "Summary saved to: $SUMMARY_FILE"
cat "$SUMMARY_FILE"

# Cleanup
kill "$CAFE_PID" 2>/dev/null
