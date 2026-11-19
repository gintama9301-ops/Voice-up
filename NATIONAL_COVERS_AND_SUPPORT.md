# National proposals: covers and community support

This VoiceUp update applies to the 23 bundled India-wide policy proposals (`VU-NATIONAL-INDIA-001` through `VU-NATIONAL-INDIA-023`).

## Cover images

Each proposal has its own locally bundled, topic-specific cover in `assets/national-covers/`. Eight are AI-generated photographic-style illustrations and fifteen are original editorial vector illustrations. They are not photos of government action, evidence of an incident, or proof of a filed petition. The proposal detail page explains this.

Edit the mapping in `assets/national-covers.js` to replace an illustration with a properly licensed real photograph for any proposal. Keep a source/permission record and avoid photos that suggest a problem at a place that was never verified.

## Support

The National policy proposals are **unfiled examples**. Registered users can endorse an idea on the VoiceUp server; this is a real account-based action but *not* a signature submitted to a government department. Each account may endorse each proposal once, or withdraw its endorsement. These endorsements are stored in the `national_endorsements` table inside `server-data/voiceup.sqlite`.

Real account endorsements **never add to** the preloaded illustration-only supporter totals, goals, statuses, or priority percentages. Both counts are displayed separately.

## Installing over an existing VoiceUp project

1. Stop the running Node server (`Ctrl+C` in the terminal).
2. **Back up** the existing `server-data/` folder, including its `uploads/` directory and `voiceup.sqlite` database.
3. Extract the update into the parent directory of `voice-up-complete`, allowing changed website files to be replaced. Do not replace or delete your `server-data` folder.
4. Open `voice-up-complete` in VS Code and run `npm.cmd start` (Node.js 22.13 or newer).
5. Visit `http://localhost:3000/explore.html`, select National and open any proposal. Test support while signed in.

The ZIP is a local website project. To share it beyond your Wi-Fi network, the Node.js server must be deployed online with HTTPS and persistent data storage.
