# VoiceUp — Shared community petitions and support

## What has changed

The project now includes a persistent **Node.js + SQLite backend**, so two visitors
connected to the **same running server** can see newly published petitions and real
account-based supporter counts. The old 835-entry collection (mostly examples) is
kept separate from community-created petitions and does **not** get fake real votes.

### Start on Windows

1. Install **Node.js 22.13+** from the official Node.js site if it is not installed.
2. Extract the ZIP completely.
3. Double-click `RUN_VOICEUP_WINDOWS.bat` (or in VS Code run `npm start`).
4. Open **http://localhost:3000**. **Do not use Live Server** for the shared version.
5. Open `account.html` to register the first account, then create a petition
   with a required photo/video as evidence.
6. On a phone connected to the same private Wi-Fi, open the printed Wi-Fi URL and register a **different account**.
7. Go to Explore, open the petition, and click **Support this petition**.
8. Leave both pages open to see the same supporter count. One support per account;
   the petition creator cannot support their own petition.

### How it stores data

- `server-data/voiceup.sqlite`: accounts, password hashes, petitions, shared support.
- `server-data/uploads/`: public evidence files of published petitions.
- These files are created automatically and are *not* bundled into downloads.
- Keep backups of **both** `server-data/voiceup.sqlite` and `server-data/uploads/`.
- Do not share passwords, email details, database files or server-data in ZIPs.
- Earlier locally created petitions in browser storage remain local and are not
  automatically migrated or made visible to other people.

### People outside your computer

`localhost:3000` is available only on your machine. To let people elsewhere use
VoiceUp, host the Node.js server on a real server/domain with **HTTPS and a
persistent disk** for both SQLite and uploaded media. The default launcher listens on the local network. Use the printed address matching your Wi-Fi adapter on both devices, particularly when copying a petition link. If the phone cannot connect, allow Node.js through the host firewall on the private network and check that the Wi-Fi permits devices to reach each other. A personal hotspot can be used if campus Wi-Fi isolates clients. Set HOST=127.0.0.1 before starting for computer-only access. Keep the laptop awake. A visible page checks for changes every two seconds.

This is a functional **shared prototype**, not a production-ready civic platform.
Before public launch, add email verification, account recovery, abuse moderation,
spam/identity protection, accessibility testing, privacy/consent processes, backup
restores, monitoring, and deployment-grade security review. One support per
registered account is **not** proof of one real person.

### Evidence and privacy

New petitions require a photo/video attachment. This media is uploaded to the
shared server and visible to all visitors on that server. Please avoid sensitive
personal information, minors' faces, home addresses, and content without permission.
The external public petitions remain links to their original platforms; VoiceUp
cannot add signatures to those external platforms.
