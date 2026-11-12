# Narration — Release Scribe offline demo

Text-to-speech script for a faceless screen recording. No face and no human voice. The committed video is [release-scribe-demo.mp4](release-scribe-demo.mp4), with captions in [release-scribe-demo.srt](release-scribe-demo.srt). Regenerate both by running [render_video.sh](render_video.sh).

The pictures are a terminal. First the Forge manifest and `src/core`, then `npm run demo` on the sample issues in this repo. Nothing is signed in, and no request leaves the machine. The app has not been installed on an Atlassian site.

Scene headings below are the default pauses for `npm run demo` (about 2 minutes 51 seconds). The renderer keeps each scene on screen for the voice line under it, including the opening, and stays under three minutes.

## Before you record

`demo/render_video.sh` does this take. The steps below are the same take if you record it by hand.

1. From the repo root, run `npm ci` once.
2. Use a terminal about 110 columns wide and 42 rows tall. Hide anything personal in the prompt. A plain shell prompt is enough.
3. Generate one audio file from the Voice lines below, in order, at a steady pace of about 150 words per minute. Any offline or hosted text-to-speech voice is fine. Keep the same voice for the whole take.
4. Start the audio as Scene 1 appears, then run `npm run demo`. Each scene stays up for the range in its heading, then the terminal clears and shows the next one.
5. If your voice track is slower than the pauses, stop and rerun with a longer hold, for example `DEMO_PAUSE_MS=22000 npm run demo`. That one value replaces every scene pause. `DEMO_PAUSE_LIST` is a comma-separated list with one millisecond value per scene. `demo/render_video.sh` sets it from the voice line under each heading. `--fast` still skips every pause.
6. `npm run demo -- --fast` prints every scene with no waiting. Use it to check the run. Use the paced command for the recording.
7. Burn the Voice lines in as captions, or upload them as subtitles. Do not put a person on camera.
8. Export at 1920×1080 if you can. Keep the finished video under five minutes. The Codegeist form wants a link judges can open, usually an unlisted upload.

## How to say it

- Say Jira, Confluence, Rovo, and Markdown as normal words.
- When the line spells the project key, say the letters: A, T, L, A, S.
- Say version numbers as “one point four point zero” and “one point three point zero”.
- “feat” is the conventional-commit prefix. Say it like “feet”.
- README is “read me”.

## Opening - Code layout

On screen: `manifest.yml` (project page, Rovo agent, two actions, scopes), the `src/core` file list, and the sample fixture path. A line says this is not installed on an Atlassian site. The recording then runs `npm run demo`.

Voice:

Release Scribe is a Forge app. The manifest registers a Jira project page and a Rovo agent with two actions. The notes engine is plain TypeScript in src/core. Next, the offline demo drafts version 1.4.0 from sample issues. This repository has not been installed on a site.

## Scene 1 of 9 - Sample project (0:00-0:20)

On screen: the banner “Release Scribe — offline demo”, then Atlas Board (ATLAS). Fix versions are listed with 1.4.0 unreleased at the top and 0.9.0 archived at the bottom. The last line says it is drafting 1.4.0.

Voice:

Release Scribe turns a Jira fix version into notes for engineering, customers, and executives. This pass uses sample issues in the repo. Nothing is signed in, and no request leaves the machine. Atlas Board, key A T L A S. Unreleased version 1.4.0 sorts first.

## Scene 2 of 9 - Fix version query (0:20-0:39)

On screen: the JQL line `project = ATLAS AND fixVersion = "1.4.0" ORDER BY issuetype ASC, key ASC`.

Voice:

The app prints the query before it searches. Project Atlas, fix version 1.4.0, ordered by issue type and key. The project page and the Rovo action share this helper. On a live site the query runs as the person who asked.

## Scene 3 of 9 - Issues from the sample search (0:39-0:58)

On screen: search page 1 of 2, seven issues, next page token `sample-page-2`. Search page 2 of 2, three issues, last page. Then the groups: Features 3, Improvements 2, Bug fixes 2, Other 3, with keys ATLAS-140 through ATLAS-155.

Voice:

The fixture matches a Jira search split across two pages. Ten issues parse into three features, two improvements, two bug fixes, and three other changes. Tasks and a spike stay under Other. Page two is how a next page token comes back.

## Scene 4 of 9 - Internal engineering (0:58-1:16)

On screen: the Internal engineering section. ATLAS-140 still shows `[INTERNAL] feat: Share a board with a guest link`, plus status and priority. The drag-and-drop bug shows escaped asterisks.

Voice:

Engineering notes keep the key, the status, and the priority. The guest link story still shows its internal tag and feat prefix. That is the original summary. Asterisks in the drag and drop title are escaped so they stay literal.

## Scene 5 of 9 - Customer-facing (1:16-1:34)

On screen: ATLAS-140’s raw summary, then the customer line “Share a board with a guest link”, then the Customer-facing section with no issue keys.

Voice:

Customer notes drop keys and status. Square-bracket tags and prefixes such as feat, fix, and chore come off. The guest link line reads, Share a board with a guest link. The query text stays in the engineering section only.

## Scene 6 of 9 - Executive summary (1:34-1:53)

On screen: one paragraph. It counts 3 features, 2 improvements, 2 bug fixes, and 3 other changes, then names the guest link, the timeline view, and the pinned column.

Voice:

The executive summary is one paragraph. It counts each group and names three highlights from the front of the list. No language model wrote it. The same issues always produce the same sentence. You can see the counts match the groups above.

## Scene 7 of 9 - Markdown file (1:53-2:11)

On screen: “Wrote demo/output/ATLAS-1.4.0.md”, the title “Release notes: ATLAS 1.4.0”, the generated date 2026-11-09, and the start of the document. A last line says more lines are in that file.

Voice:

The Markdown file stacks all three sections. It is saved under demo output as ATLAS 1.4.0 markdown. Engineering, customer, and the executive paragraph are all in that file. The timestamp is 9 November 2026, so every run matches this recording.

## Scene 8 of 9 - Changes since a version (2:11-2:30)

On screen: action `changes-since-version`, audience executive, and the JQL `fixVersion > "1.3.0"`. Counts are Features 1, Improvements 0, Bug fixes 2, Other 0. The returned markdown is only the paragraph. The file `demo/output/ATLAS-since-1.3.0-executive.md` is named at the bottom.

Voice:

The other action asks what changed since version 1.3.0. The query uses fix versions ordered after that baseline. This sample returns the 1.3.1 calendar fix, the guest link, and the drag and drop crash. The executive audience is the paragraph only.

## Scene 9 of 9 - Confluence page payload (2:30-2:51)

On screen: space id 10001 marked as sample data, the page title `Release notes: ATLAS 1.4.0 (2026-11-09)`, `POST /wiki/api/v2/pages`, and an excerpt where the script tag is `&lt;script&gt;`. The last lines say the demo stops and that Release Scribe has not been installed on an Atlassian site.

Voice:

Publish would send a Confluence storage page. The title includes the date, and the script tag is escaped to text. This demo builds the payload and does not send it. Release Scribe has not been installed on a site yet. The deploy steps are in the readme.

## After the take

- Leave the two files in `demo/output/` out of the edit. They are generated.
- Do not add a title card that says the app is live, installed, or in use by customers. It has not been deployed.
- If you later install the app on your own site, the optional live-site shots are in [docs/demo-script.md](../docs/demo-script.md). That pass is separate from this one.
