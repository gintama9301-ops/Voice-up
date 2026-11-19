# Voice Up shared working model

Extract the whole ZIP, install Node.js 22.13 or later and start one server with
`RUN_VOICEUP_WINDOWS.bat` or `npm start` from this folder. Open the printed Wi-Fi
address on every device. See SHARED_COMMUNITY_SETUP.md for the two-account demo.

## Catalogue covers

All 835 catalogue petitions have a distinct, bundled AI-generated illustration of their issue. Assignments are stored in the petition data, so the list and detail views show the same picture on every device. Open `photo-library.html` to see the category counts. The images work offline and represent the subject of a complaint. They do not document an incident at a named location.

Shared petitions use the photo or video uploaded by their author. The server keeps evidence and account-based support in `server-data/`. Keep that directory when updating an existing installation.

## Account sign-up and sign-in flow (updated)

The account screen (`account.html`) displays a single workflow at a time:

- **New member, step 1:** enter a display name and email address.
- **New member, step 2:** create and confirm a password (at least 10 characters).
- **Step 3:** registration automatically signs the member in; the account panel, shared petition actions, and local home-district preferences become available.
- **Returning member:** switch to **Sign in** and enter the email and password in a separate screen.

Account features require starting the bundled Node.js server with `npm start` and opening `http://localhost:3000/account.html`. Opening the file directly will not connect the shared database.

**Preserving an existing database:** If upgrading an already-used VoiceUp folder, preserve its `server-data/` directory (SQLite database and uploaded evidence). Replace the website code/assets and server files without deleting your existing `server-data/`. Do not place that directory in a public web server's static folder.
