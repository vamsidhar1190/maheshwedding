# Wedding Surprise Website ❤️

Plain HTML, CSS and JavaScript — no frameworks, no build step.

## Open it
Double-click `index.html`, or host the whole folder anywhere static
(Netlify Drop, GitHub Pages, Vercel, Firebase Hosting) and share the link.

## Folder
```
index.html        page structure (all 7 steps)
css/style.css     royal wedding theme, animations, responsive layout
js/data.js        ← EDIT THIS: captions, friend names & wishes, letter, reveal text
js/fx.js          rose petals, golden sparkles, hearts, confetti (canvas)
js/sound.js       built-in soft melody, countdown heartbeats, curtain swell
js/studio.js      Photo Studio (upload / reorder / caption)
js/app.js         scene flow, envelope, typing letter, grand reveal, lightbox
assets/friends/   group photos (Polaroids + finale wall)
assets/gang/      one portrait per friend (flip cards)
assets/wedding/   bride & groom — 01 is the main portrait
```

## Customize
**Quick:** edit `js/data.js`. Put real names in each friend's `"name": ""`.

**Visual:** open `index.html?edit` → "✎ Customize photos & messages".
Upload photos into the three categories, drag or ↑↓ to reorder, ★ to pick the
main wedding portrait, edit captions/wishes/letter, and add your own mp3.
"Save & preview" keeps changes in that browser; "Download data.js" gives you a
file to replace `js/data.js` so the shared copy has your changes.

Wedding photos are never added to the page until the countdown finishes.

To use a real song instead of the built-in melody, drop `song.mp3` in the folder
and set `music: "song.mp3"` in `js/data.js`.
