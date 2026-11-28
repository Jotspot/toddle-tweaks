# Toddle Tweaks: store listing kit

Everything to paste into the Chrome Web Store and Firefox Add-ons (AMO) dashboards.
Images are in `store/images/chrome/` and `store/images/firefox/`. Upload zips are in `dist/` (run `node scripts/build.mjs`).

---

## Name
**Toddle Tweaks**

## Short description
Chrome "Summary" (max 132 chars) / AMO "Summary" (max 250 chars):

> A better Toddle: a smarter to-do, a whole-week timetable, faster pages and an optional Google Classroom look.

AMO currently uses a longer version: "A better Toddle: a smarter to-do, a whole-week timetable, all your grades on one page, faster pages and an optional Google Classroom look. Turn any part of it on or off."

(Chrome takes this from `description` in `manifest.json`, so the two are kept the same.)

## Category
- Chrome Web Store: **Education** (alternative: Productivity → Tools)
- AMO: **Productivity** (alternative: Other)

## Full description

```
Toddle Tweaks fixes the parts of Toddle (web.toddleapp.com) that get in your way.

Every feature is toggleable, even Google Classroom mode. Speaking of features:

To-Do Tweaks:
• Sorted by when things are due: Missing, Today, Tomorrow, This week, Next week, Later, etc.
• Old in-class items you can't turn in stop clogging up the list
• Quizzes, tests and summatives are labelled so they stand out
• Tick an in-class item and it's marked done in Toddle, with an Undo button in case you slip
• Filter by class, or sort it up to seven ways!

Schedule Tweaks:
• A Timetable that shows your whole week, with your school's A/B/C/D days, blocks like A1 and B3, holidays and what's due in each class
• Export every class meeting to Google Calendar, Apple Calendar or Outlook for the whole semester. Holidays are skipped and late starts get their real times, with step-by-step import help
• A calm Finals page that shows up a few weeks before exams: a day count, your exam schedule, and what's due before finals start
• A workload heatmap so you can see which days are heavy at a glance
• Attendance at a glance: your percentage, each class, and any period you weren't marked present
• Optional: your next class in the top bar

Grades Tweaks (Middle School):
• Every graded assessment in every class on one page, with your standard levels, learning behaviors, scores and teacher comments
• A Standards view: every level you've had on each standard, oldest to newest
• Bring back the old level names (Below · Approaching · Meets · Exemplary), on Toddle's own pages too
• Optional PowerSchool-style look: Grades and Attendance, Scores for each class, and Standards Grades

Course Plan Tweaks:
• Google Docs, Slides, Sheets and Drive links open in their own tab instead of Toddle's (horrendous) little viewer
• "Due on 23rd Nov, 8:30 AM" also says "in 2 days"
• Middle-click a class or assignment to open it in a new tab

Speed Tweaks:
• You see a cached copy of the page straight away while Toddle loads
• Settings, class lists and course plans load from your computer (not the cloud :P)
• Trackers and ad pixels are blocked

Google Classroom Mode:
• Toddle laid out like Google Classroom: class cards with banners, plus Stream, Classwork & People for each class
• A (good) to-do page and a calendar of everything due, exportable to Google, Apple or Outlook
• Put your classes in any order, pick banners, hide the ones you don't
• Not your thing? One switch turns it off

Extras:
• Ctrl/⌘ + K to jump to any class, assignment, page or setting, with the class you're in right now at the top (this is amazing btw)
• Keyboard shortcuts, including [ and ] to move between a class's sections (hit ? to see em')
• Timetable, Calendar, Attendance and Finals work in regular Toddle too, from Ctrl/⌘ + K
• A little count in the tab title for what's missing or due soon

Privacy:
There are no Toddle Tweaks servers and no analytics, and nothing about you is collected. Your settings and cached pages stay in your browser. The extension talks to Toddle using the account you're already signed in with. Classroom banners and Doc and video previews load from Google and YouTube, like any other picture on a web page.

School Support:
So far it's only been tested at Singapore American School. Other schools set up Toddle a bit differently, so some things might not work the same. If something looks off at your school, open an issue on GitHub :)

Free & Open Source:
Toddle Tweaks is free and open source (MIT License)! You can read the code, report a bug or suggest something on GitHub:
https://github.com/Jotspot/toddle-tweaks

Toddle Tweaks is an independent project. It isn't affiliated with, endorsed by or sponsored by Toddle or Google.
```

## Single purpose (Chrome)
> Toddle Tweaks improves the Toddle learning platform (web.toddleapp.com): it reorganizes assignments into a smarter to-do list, shows the student's timetable, finals, attendance and grades more clearly, offers an alternative layout, and speeds up page loads. It only runs on toddleapp.com.

## Permission justifications (Chrome "Privacy practices" tab)

| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings (e.g. which layout and features are on) and syncs them across their own browsers. |
| `declarativeNetRequest` | Blocks third-party analytics and ad trackers that load on toddleapp.com, optionally hides the help-chat widget, and redirects the toddleapp.com marketing homepage straight to the sign-in page. All rules are static and ship inside the extension. |
| Host permission `https://web.toddleapp.com/*`, `https://*.toddleapp.com/*` | The extension only works on Toddle. It runs content scripts on web.toddleapp.com and calls Toddle's own API (ap-southeast-1-production-apis.toddleapp.com etc.) with the user's existing session to read their classes and assignments. |

**Remote code:** No. All JavaScript is packaged in the extension. (Fonts are loaded from Google Fonts as stylesheets; no remote scripts.)

## Data usage disclosures (Chrome)

Tick these data types (they are *handled locally*, never sent to the developer):
- **Personally identifiable information**: the user's name and profile picture shown in the account menu, teacher and classmate names and teachers' email addresses from Toddle.
- **Authentication information**: the user's existing Toddle session token is used to call Toddle's API on their behalf. It is never stored elsewhere or transmitted anywhere except Toddle.
- **Website content**: assignments, announcements, class information, the timetable, the school calendar, the student's attendance and grades from Toddle, cached locally for speed.

Certify all three:
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://jotspot.github.io/toddle-tweaks/privacy-policy.html (source: `docs/privacy-policy.html`, served by GitHub Pages)

## Firefox (AMO) specifics
- **Data collection** (in the manifest, already set): `"data_collection_permissions": { "required": ["none"] }`, because nothing is sent to the developer.
- **Source code:** not required. The extension isn't minified, bundled or obfuscated.
- **License:** MIT License (choose "MIT License" in the AMO form).
- **Minimum Firefox:** 128 (needed for page-context content scripts).
- **Notes to reviewer** (paste into "Notes for Reviewers"):

```
Toddle Tweaks only runs on web.toddleapp.com, a school learning platform that requires a school-issued account, so it can't be fully exercised without one. It has been verified with Singapore American School's Toddle.

What it does:
- src/page-hook.js runs in the page context (world: MAIN) to wrap fetch: it caches a small allowlist of slow, rarely-changing GraphQL queries in IndexedDB and notices Toddle's own task filters. It never sends data anywhere new.
- Isolated content scripts read assignments/classes from Toddle's GraphQL API using the session token Toddle already stores in localStorage, and render an alternative UI.
- rules/*.json are static declarativeNetRequest rules: block analytics/trackers, optionally hide Intercom, redirect toddleapp.com's marketing homepage to the web app.
- No remote code, no analytics, no external servers. Fonts come from Google Fonts (stylesheet only). Images only: Classroom banner art (www.gstatic.com) and course-plan previews of Google Docs/YouTube links (drive.google.com/thumbnail, i.ytimg.com), loaded as <img>.
- When a Google Docs/Drive link opens in Toddle's viewer, src/extras.js clicks Toddle's own "Open in Google Docs" button and closes the viewer (setting: docsNewTab).
- Announcement/assignment HTML from Toddle is sanitized with an allow-list (TT.sanitize in src/common.js) before display.
- src/school.js reads the student's timetable, school calendar, grading periods, bell schedules and attendance from the same Toddle API (read-only) to draw the Timetable, Finals and Attendance pages. api.getGrades (src/api.js) reads the student's own evaluated assessments (read-only) for the Grades page.
- The only write to Toddle is the student's own "Mark as done" on an assignment with nothing to turn in (api.markDone in src/api.js), sent only when the student ticks it and doesn't press Undo.
- Calendar export builds an .ics file in the page and downloads it. Nothing is uploaded.
- On first install, background.js opens onboarding/welcome.html (an extension page). It only saves the layout choice and, on Firefox, offers a button that calls permissions.request for web.toddleapp.com.
```

## Support / homepage
- Support URL: https://github.com/Jotspot/toddle-tweaks/issues
- Homepage: https://github.com/Jotspot/toddle-tweaks
- Chrome Web Store: https://chromewebstore.google.com/detail/toddle-tweaks/apaanjjkejkkekmbkgecnlbjmfdcgncg
- Firefox Add-ons: https://addons.mozilla.org/firefox/addon/toddle-tweaks/

## Images checklist

| Store | Asset | Size | File |
|---|---|---|---|
| Chrome | Store icon | 128×128 | `icons/icon128.png` |
| Chrome | Screenshots (1–5) | 1280×800 | `store/images/chrome/screenshot-1…5.png` |
| Chrome | Small promo tile | 440×280 | `store/images/chrome/promo-small-440x280.png` |
| Chrome | Marquee promo tile | 1400×560 | `store/images/chrome/promo-marquee-1400x560.png` |
| Firefox | Icon | 128×128 (64 also fine) | `icons/icon128.png` |
| Firefox | Screenshots | 1280×800 | `store/images/firefox/screenshot-1…5.png` |

All example data in the images is made up.
