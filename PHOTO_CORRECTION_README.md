# VoiceUp website photo correction — Nov 14, 2026

The website code (`assets/app.js`) now selects local covers for:

- **Hospital maintenance / healthcare:** `assets/offline-photos/hospital-maintenance-issue.jpg` — visibly dilapidated building.
- **Streetlights / public lighting:** `assets/offline-photos/unlit-street-issue.jpg` — dark, underlit street.

These two local images are AI-generated **illustrations**, not genuine photographs or location-specific evidence. They are intentionally pinned in the card and petition-detail HTML so remote image matching cannot override them. Other categories retain existing locally bundled/user-uploaded/Commons photo behavior.

Open `explore.html` with Live Server and search **hospital maintenance** or **streetlights**. Open the matching petition details to see the same covers. If you had an older version, extract this ZIP into a **new folder** rather than mixing files.

The existing example supporters and generated petition statuses remain demonstration data; they are not real signatures or government actions.
