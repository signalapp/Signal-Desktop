set -e
find release/linux-unpacked -type d | xargs chmod 755
find release/linux-unpacked -type f | xargs chmod 644
find release/win-unpacked -type d | xargs chmod 755
find release/win-unpacked -type f | xargs chmod 644
