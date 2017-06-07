find release/linux-unpacked -type d -not -perm 755 -o -type f -not -perm 644 | xargs stat
find release/win-unpacked -type d -not -perm 755 -o -type f -not -perm 644 | xargs stat
