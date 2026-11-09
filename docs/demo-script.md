# Demo script — live site (optional)

The recording that does not need an Atlassian site, a face, or a human voice is [demo/narration.md](../demo/narration.md), played over `npm run demo`. Use that for the submission if the app is not installed yet.

The shots below are an optional second pass after you install Release Scribe on your own site. They are not a record of a deployment. This repository has not been deployed. Target length for this live pass is about 4 minutes 30 seconds, under the 5 minute Codegeist limit. Captions and a text-to-speech voice. Nobody needs to appear or speak.

## Before you record

1. Finish the deploy steps in the README, including a production install on a site where you can browse a Jira project and create a Confluence page.
2. Use a project that already has a fix version with a mix of stories, bugs, and tasks. Two versions are enough: an older one (the baseline) and the one you are releasing. Example names used below: project `PROJ`, versions `1.1.0` and `1.2.0`. Swap in your real names everywhere.
3. Close extra browser tabs. Zoom the window so the project page and Rovo chat are readable at 1080p.
4. Turn on the browser’s bookmark bar only if you want. Hide personal bookmarks.
5. Pick a text-to-speech voice and generate one audio file per line in the Voice column, or one file of the whole script. Any offline or hosted TTS is fine. Keep the voice consistent.
6. Burn captions into the video, or upload them as YouTube subtitles using the Caption column. The words can match the voice exactly.
7. Record the whole pass, then cut the pauses. A title card can be the first frame of the recording (a blank Confluence page or a slide) with the words below. Do not film a face.

## Title card (0:00–0:08)

On screen, centered:

> Release Scribe
> Release notes from a Jira fix version
> Codegeist 2026

| Time | On screen | Caption | Voice |
| --- | --- | --- | --- |
| 0:00 | Title card | Release Scribe. Release notes from a Jira fix version. | Release Scribe turns a Jira fix version into notes for engineering, customers, and executives. |

## The project page (0:08–2:10)

Start signed in to Jira, on the project that holds the sample version. The left navigation is visible.

| Time | Do this | Caption | Voice |
| --- | --- | --- | --- |
| 0:08 | Click **Release Scribe** in the project apps. Wait until the project and version selects have loaded. | Open Release Scribe on the project. | From the project, open Release Scribe. It already knows which project you are in. |
| 0:25 | Open the fix version menu. Point the cursor at `1.2.0` and select it. Pause on the JQL line under the menu. | Choose the fix version. The JQL is shown before anything runs. | Choose the fix version. Release Scribe shows the JQL it will run, and it runs that query as you. |
| 0:45 | Click **Draft release notes**. Wait for the lozenges and the grouped list. | Issues grouped into Features, Improvements, Bug fixes, and Other. | The issues come back grouped. Features, improvements, bug fixes, and anything else, such as tasks, stay separate. |
| 1:05 | Scroll the group list slowly, then click the **Engineering** tab. Select one line that shows an issue key and a status so the selection is visible. | Engineering notes keep the issue key, status, and priority. | Engineering notes keep the key, the status, and the priority. Select the text and copy it. Nothing was sent to an outside model. The sentences are rules, so the same issues always draft the same way. |
| 1:30 | Click **Customer**. Hover a line that, in Jira, had a `feat:` or `[INTERNAL]` prefix if you have one. Otherwise just show the customer bullets with no keys. | Customer notes drop issue keys and internal tags. | Customer notes drop the keys and internal tags. Same issues, different reader. |
| 1:48 | Click **Executive**. Leave the paragraph on screen. | One paragraph for the release. | The executive summary is a single paragraph: how many features, fixes, and other changes, plus a few highlights. |
| 2:05 | Click **Markdown** and show the headings Internal engineering, Customer-facing, and Executive summary. | The full draft is Markdown. | The Markdown tab is the whole document, ready to paste somewhere else. |

## Publish (2:10–3:05)

| Time | Do this | Caption | Voice |
| --- | --- | --- | --- |
| 2:10 | Scroll to **Publish to Confluence**. Open the space menu and choose a space you can edit, for example a Releases space. | Pick a Confluence space. | Publishing uses a space on the same site. |
| 2:25 | Show the page title. Edit one word if you want the field to look live, then click **Publish page**. | Create the page from this draft. | The title is filled in. Publish creates the page from the draft on screen. |
| 2:40 | When the success message appears, click the link. Let the Confluence page load, then scroll from the engineering list to the executive paragraph. | The Confluence page is the same draft. | The page is the same notes. Headings, the issue list, and the executive paragraph. Issue text is escaped, so a summary cannot turn into markup. |
| 3:00 | Click the browser Back button to return to the Jira page. | Back to Jira. | Back in Jira, the draft is still there. |

## JQL, briefly (3:05–3:25)

| Time | Do this | Caption | Voice |
| --- | --- | --- | --- |
| 3:05 | Change **Source** to **JQL query**. Paste a short query you have already tested, such as `project = PROJ AND fixVersion = "1.2.0" AND type = Bug ORDER BY key ASC`. Click **Draft release notes**. | Any JQL query you can already run. | A fix version is the default. Any JQL query works too, and it still only returns issues you are allowed to see. |

You can cut this shot if you are over time. The version flow is the one that matters.

## Rovo (3:25–4:25)

Open the Rovo chat from the top bar. Do not use a personal conversation history. Start a new chat if the panel shows an old one.

| Time | Do this | Caption | Voice |
| --- | --- | --- | --- |
| 3:25 | In the agent list, choose **Release Scribe**. If a starter is visible, you can click it instead of typing, as long as the next prompt still names the version. | The Release Scribe agent in Rovo. | The same draft is available in Rovo. The agent does not invent issues. It calls a Forge action, and the action uses the same renderer as the page. |
| 3:40 | Send: `Draft release notes for version 1.2.0 of PROJ`. Wait until the reply finishes. Scroll so a heading and one issue key are visible. | Draft release notes for version 1.2.0. | Ask for a version. The reply is the notes: engineering, customer, and the executive paragraph. |
| 4:05 | Send: `What changed in PROJ since version 1.1.0?` Wait for the reply. | What changed since version 1.1.0? | Ask what changed since an earlier version. That is the second action. It finds issues fixed in versions after that baseline. |
| 4:20 | Send: `Just the executive summary.` Show the short reply. | One audience, when that is all you need. | Ask for one audience and the action returns only that section. |

## Close (4:25–4:35)

Cut back to the title card, or stay on the executive reply and fade.

| Time | On screen | Caption | Voice |
| --- | --- | --- | --- |
| 4:25 | Title card, plus a line: Install from the Codegeist submission. | Release Scribe. Install link in the submission. | Release Scribe. The install link is in the Codegeist submission. |

## If something goes wrong while recording

- Empty version: pick a version that has issues, or create two stories and a bug and set their fix version before you start. Do not invent data on camera.
- Consent popup the first time the page calls Jira: that is expected. If it appears, let it stay in the video and approve it. The caption can read “Grant the app access to Jira as you.” Say the same in the voice track.
- Duplicate Confluence title: change the date in the title field and publish again. The script’s publish shot still works.
- Rovo cannot see the agent: confirm the app is installed on that site, Rovo is enabled, and you deployed the environment you installed. Development and production are different installs.
- Do not show API tokens, the Forge CLI logged-in email, or another site’s data. The sample project is enough.

## Export

- 1920×1080, or 1280×720 if the window is smaller. 1080p is easier for judges to read.
- Upload to YouTube as Unlisted. Paste the URL into the Devpost form. The video must be under 5:00 after the cut.
