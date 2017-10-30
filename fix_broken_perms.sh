set -e
find release/linux -type d | xargs chmod 755
find release/linux -type f | xargs chmod 644
chmod +x release/linux/signal-desktop*
