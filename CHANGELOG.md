# Changelog

## 2.7.1
- Finals shows up again for people whose semester dates failed to load once (for example while switching accounts): a failed lookup is no longer remembered as "no semesters" for days, and it tries again by itself
- Switching to a different Toddle account on the same browser clears the last person's cached classes, grades, timetable, finals and page snapshots. Settings and layout choices stay
- Grades is middle school only for now: high school doesn't grade in Toddle until next year, so it's left out of the menu, Ctrl/⌘ + K and Toddle's gradebook there

## 2.7.0
- Grades on one page, laid out like Classwork: every graded assessment in every class with your standard levels, learning behaviors, scores, rubric and checklist rows, and your teacher's comments (shown like private comments). No more clicking a class, then an icon, to see one level
- Overview at the top of Grades: how many assessments are graded and missing, and how your standard levels and learning behaviors add up for the term and class you picked (can be turned off in Settings)
- Standards tab: each class as a table of its standards with every level you've had on each one, oldest to newest, and the most recent. Filter by semester, class or summatives, and search assessments, standards and comments
- Toddle's gradebook links open the new Grades page (on the class you clicked); "Toddle's gradebook" still opens Toddle's own for final grades. In regular Toddle it opens from Ctrl/⌘ + K or g r
- Class Stream shows the class's description (About this class) and the teacher's quick links from Toddle
- Customize the Stream: turn Upcoming, About this class and Quick links on or off and reorder them, put About and links above the posts, use the teacher's banner picture or a slim banner, and hide the post filter or "posted a new assignment" cards
- New "Grades (Middle School)" section in Settings: the Grades page's look, level names, whether learning behaviors and comments show, and a Grades button on Toddle's gradebook in regular Toddle
- Level names: keep the new scale (NE · EM · DE · ME · MWD), call just the top level Exemplary, or go back to the old Below · Approaching · Meets · Exemplary. Applies to the Grades page and (switchable) to Toddle's own rubrics, assignments and gradebook, in Classroom mode and regular Toddle
- PowerSchool-style look for Grades (Settings → Grades (Middle School) → Grades look), modelled on SAS's PowerSchool student portal: Grades and Attendance (classes in expression order like 1(A) or 3(A-B), "Email Last, First - Rm:" under each class, a grade per semester with shaded terms you're not in and [ i ] for nothing graded), a Scores page for each class when you click a grade (final level, section description, every assignment with flag icons, score, %, grade and comments), and Standards Grades (Learning Behaviors per term, then Academic Standards per class with a column per semester, written out like "Meets Expectations" with the old names). Each class's Scores page has its own address, so Back returns to Grades and Attendance
- Grades: Collapse all / Expand all for the classes, and the usual level next to each class is bigger, with a book icon in the menu
- Settings opens on Highlights: the settings people at your school go looking for (middle school: old level names, PowerSchool-style grades and more; high school: finals, timetable, next class). It finds your school from Toddle, and you can switch to see the others
- Settings: "Finals (High School)", and shorter Level names choices that fit on one line
- Next class in the top bar is plain text with a clock icon ("Next: Chemistry in 12 min · H306") instead of a pill
- Dragging class cards: the others slide out of the way, the card leaves a dashed slot, gaps between cards work, letting go anywhere keeps the new order, and Esc cancels
- New setting: the folded-up menu slides open when you rest the mouse on it (off by default)
- Course plan: the topic list on the left folds away to give the plan more room (remembered)
- Assignments open over the page you opened them from (Grades, Stream, To-do…) instead of flashing the class's Classwork first. Closing one no longer flashes Toddle's old Assignments page, and Toddle's back arrow returns to the page you came from instead of Home
- Announcements you expanded and Classwork items you opened stay open when you switch browser tabs or come back from elsewhere in Toddle, and pages remember where you'd scrolled
- Assignments you've turned in or marked done no longer show a red "11 days ago" next to the due date
- Small cleanups: no emoji in empty to-do messages, plain headings in the popup

## 2.6.0
- New welcome page after installing: the main features in one place, plus a choice of Classroom or regular look. Skip it to keep the defaults; it's also in Settings
- Timetable shows your whole week (Monday to Friday) with your school's A/B/C/D days, class blocks like A1 or B3, holidays, finals days, the class you're in now, and what's due in each class that day
- Export your timetable to Google Calendar: every class meeting for the semester (or the year), written out one by one, so holidays, late starts and exam days are right. Step-by-step import directions included (works with Apple Calendar and Outlook too)
- Finals: a Finals page shows up in the menu about six weeks before exams. A day count, your exam schedule (found from your school's bell schedule) with every class's final, and what's due before finals. Rename a final or mark a class as having none; exam dates can also be set by hand
- Workload heatmap: your week coloured by how much is due, on the Calendar (and optionally the Timetable, Home, To-do or the menu). Expand it for six weeks and insights like your busiest and lightest days and upcoming tests. Every part can be turned on or off
- Attendance as a Classroom page: your percentage, a breakdown, the year at a glance, every class, and each period you weren't marked present, with a button to Toddle's own attendance page
- Optional "Next: Chemistry in 12 min · H306" in the top bar (off by default)
- The to-do checkbox marks things as done in Toddle itself (the same as Toddle's own Mark as done button), with Undo. Work that needs turning in is finished on Toddle. Automatically checked-off items sit at the bottom of the Done tab
- Ctrl/⌘ + K finds everything: pages, actions like exporting the timetable, and settings you can switch on or off. The class you're in now (or next) is always first, then missing and due-soon work
- Keyboard shortcuts: [ and ] move between a class's Stream, Classwork, People, Course plan and Portfolio, 1 to 5 jump to one, Shift + [ / ] go to the previous or next class, g 1 to g 9 open a class, g w timetable, g a attendance, g f finals
- Calendar, Timetable, Attendance and Finals also work in regular Toddle (Ctrl/⌘ + K or the shortcuts open them over the page)
- Settings are grouped by what they're for (Start here, To-do, Timetable, Finals, Heatmap, Classroom look, Shortcuts, Speed)

## 2.5.1
- Same features as 2.5.0, now on Firefox Add-ons (the 2.5.0 number was already taken by a self-distributed Firefox build)

## 2.5.0
- Google Docs, Slides, Sheets, Drive, Microsoft 365, Canva and similar links open in a new tab instead of Toddle's cramped built-in viewer (on by default; there's also an option for every web link)
- Course plan looks more like Google Classroom: round colour-coded file icons, real previews of Docs, Slides and YouTube videos in place of Toddle's blank placeholder, a topic list that follows you as you scroll, and Classroom-style folders
- New setting "Course plan pictures": Previews, Classroom-style Cards, or Icons only
- 19 more Google Classroom banners (World history, US history, Geometry, Design, Track, Fitness, Sailing, Cycling and more), picked automatically for matching classes
- Summatives and tests get their own icons instead of a question mark
- Course plan previews that can't load (no access, blocked) are skipped for a week instead of being fetched again on every visit
- Narrow windows: assignment titles no longer run off the edge, the course plan's topics become a row of chips, and class tabs scroll
- "Toddle Tweaks updated! See what's new" note after an update, linking to the new changelog page (can be turned off)
- Release zips on GitHub are now built automatically for each version

## 2.4.1
- Popup: the "needs access to Toddle" banner no longer shows when access is already granted, and the Give access button now explains what to do if the browser does not show a prompt

## 2.4.0
- Course plan rebuilt as a Classroom-style page: units as collapsible topics with a topic list, folders, links that open directly, assignments with your status, search, and the current unit opened automatically (Classic view still available)
- Stream: All / Announcements / Classwork posts filter, with an unread marker

## 2.3.1
- Classroom mode is on by default; Google Classroom banner art is the default
- The Intercom chat bubble is hidden by default (switch it back on in Settings)
- Narrow windows: assignment pages switch to a single column instead of being cut off, and below 1100px the menu becomes a slide-over
- Quick jump: finished items show their due date instead of "days late"

## 2.3.0 (first public release)
- Classroom-style mode: home with class cards, Stream / Classwork / People, To-do, Calendar, guided tour
- Smart to-do with Missing / Today / This week grouping and seven sort orders
- Advanced class settings (rename, section, teacher shown, restore)
- Quick jump (Ctrl/⌘ + K), keyboard shortcuts, tab badge, relative due dates, calendar export (.ics)
- Speed: instant snapshots, cached config, class lists and course plans, tracker blocking
- Settings page grouped by mode, with previews
- Firefox support (Firefox 128+)
