# Create fake contacts

Run `window.getAccountManager().addMockContact()` in the debugger console. This will print the fake contact public key.
Behind the scenes, this also emulates that we're already received the contact's prekeys by generating them and saving them in our db.
Copy/paste that public key in the search bar to start chatting.
The messages should have a "v" tick to mark that the message was correctly sent (you need to run the httpserver from /mockup_servers)