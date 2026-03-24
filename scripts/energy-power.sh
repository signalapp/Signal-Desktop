#!/bin/bash
# energy-power.sh — Capture actual power (watts) using powermetrics
# Usage: sudo ./scripts/energy-power.sh [pq|nopq] [duration_seconds]
#
# Requires: sudo (powermetrics needs root)
# Output: Raw powermetrics data + parsed summary

MODE="${1:-pq}"
DURATION="${2:-120}"
LOG_DIR="$HOME/SignalEnergyLogs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RAW_FILE="$LOG_DIR/power_raw_${MODE}_${TIMESTAMP}.txt"
PARSED_FILE="$LOG_DIR/power_parsed_${MODE}_${TIMESTAMP}.csv"

mkdir -p "$LOG_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "This script needs sudo for powermetrics."
  echo "Run: sudo ./scripts/energy-power.sh $MODE $DURATION"
  exit 1
fi

SIGNAL_PID=$(pgrep -f "Signal" | head -1)
if [ -z "$SIGNAL_PID" ]; then
  echo "Signal is not running. Start it first."
  exit 1
fi

echo "Capturing power data for Signal (PID: $SIGNAL_PID)"
echo "Mode: $MODE | Duration: ${DURATION}s"
echo "Raw output: $RAW_FILE"
echo ""

# Sample every 5 seconds, run for DURATION
SAMPLES=$((DURATION / 5))

powermetrics \
  --samplers cpu_power,tasks \
  --show-process-energy \
  -i 5000 \
  -n "$SAMPLES" \
  > "$RAW_FILE" 2>&1 &

PM_PID=$!

# Show progress
ELAPSED=0
while kill -0 "$PM_PID" 2>/dev/null; do
  printf "\rCapturing... %ds / %ds" "$ELAPSED" "$DURATION"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo ""
echo ""
echo "Capture complete. Parsing results..."

# Parse CPU power and Signal-specific entries
echo "sample,cpu_power_mw,gpu_power_mw" > "$PARSED_FILE"

grep -E "(CPU Power|GPU Power|Signal)" "$RAW_FILE" > "$LOG_DIR/power_signal_${MODE}_${TIMESTAMP}.txt"

# Summary
{
  echo "=== Power Measurement Summary ==="
  echo "Mode: $MODE"
  echo "Duration: ${DURATION}s (sampled every 5s)"
  echo "Date: $(date)"
  echo ""
  echo "--- CPU Power ---"
  grep "CPU Power" "$RAW_FILE" | head -20
  echo ""
  echo "--- Signal Process Energy ---"
  grep -A2 "Signal" "$RAW_FILE" | head -30
} > "$LOG_DIR/power_summary_${MODE}_${TIMESTAMP}.txt"

cat "$LOG_DIR/power_summary_${MODE}_${TIMESTAMP}.txt"
echo ""
echo "Full raw data: $RAW_FILE"
