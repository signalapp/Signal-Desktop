call pnpm run generate

if exist "C:\Users\minhm\AppData\Roaming\Signal-development" (
    rd /s /q "C:\Users\minhm\AppData\Roaming\Signal-development"
)

call pnpm start