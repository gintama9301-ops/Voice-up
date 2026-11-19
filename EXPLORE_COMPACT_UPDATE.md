# VoiceUp – Compact Explore page

The Explore page now follows the older compact layout while retaining the shared petition system.

Changes:
- Consolidated multiple large information boxes into a short plain-text line under the page heading.
- Moved **Community only** next to the District/State/National tabs (same filter behavior).
- Removed redundant district-directory text above cards (state/district dropdowns remain).
- Reduced spacing and cover/card heights to show petitions sooner.
- Preserved 835 catalogue entries (578 District, 234 State, 23 National), shared supporter data, account creation, creator evidence and the National globe design.

## Install without replacing your database

Use the **small update ZIP** to overwrite just these three files in your existing `voice-up-complete` folder:

1. `assets/app.js`
2. `assets/styles.css`
3. `explore.html`

Then run `npm start` and open `http://localhost:3000/explore.html`.
Do **not** overwrite or delete your `server-data` directory; it contains your registered users, shared petitions and uploaded evidence.

Do not open the HTML file by double-clicking it. The shared support service needs the Node.js server.
