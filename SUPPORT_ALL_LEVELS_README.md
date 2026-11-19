# Shared support across District, State and National

Each of the 835 bundled catalogue entries can now receive one registered account endorsement per user.

* Generated examples show `displayed supporters = demo baseline + registered endorsements` and update on support/withdraw. Example figures remain explicitly marked as sample data.
* Original public petition signature snapshots are NOT modified; registered VoiceUp endorsements appear separately.
* Users can also support newly created community petitions. Their support counts are fully account-based, not sample figures.
* Support history is kept in SQLite under `server-data/voiceup.sqlite`. Existing National endorsements are migrated on first start.
* After replacing code, preserve the `server-data` folder to retain existing accounts, uploads and support records.
* Run `npm.cmd start` from the `voice-up-complete` directory and visit `http://localhost:3000` (not Live Server).
