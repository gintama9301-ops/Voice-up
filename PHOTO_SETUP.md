# Photo setup — 30 real photos for every category

**Target:** 19 × 30 = 570 independently licensed, non-repeating real photos.

**Actual packaged count:** Open `photo-library.html` to check. Initially it is 0 verified downloaded Commons photos, plus 8 user-uploaded road images with unverified rights. The 2 problem-condition visuals for hospital maintenance and dark roads are AI illustrations, not real photos.

## Run the collector

On Windows double-click `BUILD_PHOTO_LIBRARY_WINDOWS.bat` from the website folder. Python, internet connectivity, and available disk space are required. The tool will continue from any downloads from a previous run.

To update one category from VS Code:

```bash
python tools/download_photo_library.py --category "Streetlights & Public Lighting" --target 30
```

The tool verifies licence metadata, checks SHA256 and perceptual hashes, rejects basic off-topic matches, and writes attribution to `data/photo-library-sources.csv`. The site links to the photo source. Source metadata should be reviewed before public launch.

## No repeats / stable mapping

Visible cards are assigned distinct source IDs where the available photo library is large enough; otherwise, a category illustration is used. Petition photo preferences are stored in browser localStorage. Clearing browser storage resets them, but the same downloaded library will still produce a deterministic assignment order.

## Local imagery and origin labels

- Locally downloaded Commons photos: **Representative open-licensed photograph** (licensed and credited, not local evidence)
- Eight uploaded road photos: **Uploaded reference** (source and permission should be confirmed)
- Hospital/streetlight issue illustration and other SVG icons: **Illustration — not evidence**

Do **not** put a photograph of a normal hospital or brightly illuminated street on a maintenance complaint or lack-of-streetlights petition. The search patterns in `assets/category-photo-config.js` prioritize visibly failing infrastructure. Automatic matches still need human visual review.
