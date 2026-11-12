# Release Scribe — Codegeist 2026

Author: David Zhu.

Tagline: Release notes from a Jira fix version, written for engineering, customers, and executives.

Paste the sections below into the [Codegeist 2026](https://codegeist2026.devpost.com/) form. Deadline: 22 December 2026, 12:00pm PST. The install link and the public YouTube URL are still open. The offline recording is in [demo/release-scribe-demo.mp4](demo/release-scribe-demo.mp4) (2 minutes 47 seconds). This repository has not been deployed to an Atlassian site, and it does not report user counts or other usage metrics.

Suggested links once the manual steps below are done:

- Install link: the Sharing link from the developer console after `forge deploy -e production`.
- Video: a public YouTube URL. The rules require the video to be public and under five minutes. [demo/release-scribe-demo.mp4](demo/release-scribe-demo.mp4) (captions in [demo/release-scribe-demo.srt](demo/release-scribe-demo.srt)) is a terminal recording of sample data, with offline text-to-speech and no face. It does not show the app installed on Jira. Prefer a site recording from [docs/demo-script.md](docs/demo-script.md) once the app is installed. No face and no human voice are required for that recording either.

## Inspiration

Shipping a version is a Jira filter and a blank page. The people who need the notes are not looking at the same thing: engineering wants keys and priorities, customers want what changed for them, and a lead wants one paragraph. Teams rewrite that three times, usually the night before the release, and the Confluence page drifts from the issues that actually shipped.

Release Scribe starts from the fix version (or a JQL query, when the version is not the whole story) and produces all three drafts from the same issues. Publishing puts that draft on a Confluence page without another copy-paste. A Rovo agent answers the same questions in chat, which is how people already ask what shipped.

## What it does

- Adds a **Release Scribe** page to each Jira project.
- Lets someone pick a project and a fix version, or paste a JQL query.
- Groups the issues into Features, Improvements, Bug fixes, and Other.
- Drafts three audiences: internal engineering (keys, status, priority), customer-facing (no keys, internal tags stripped), and a one-paragraph executive summary.
- Shows the full notes as Markdown that can be selected and copied.
- Publishes the notes to a chosen Confluence space.
- Registers a Rovo agent with two actions: draft the notes for a version, and summarise what changed since a version. The same actions are MCP tools (`rovo:mcp`) for other agents.

The draft is deterministic. The same issues produce the same sentences, with or without Rovo, and with or without a network call to a model.

`npm run demo` runs that pipeline on sample Jira issues in `demo/fixtures/atlas-board.json` and writes the notes under `demo/output/`. That run does not contact an Atlassian site.

## How we built it

Release Scribe is an Atlassian Forge app on the Node.js 24 runtime.

- The project page is UI Kit (`jira:projectPage`, `render: native`). It calls a Forge resolver.
- The resolver reads projects, versions, and issues with `api.asUser().requestJira`, and creates pages with `api.asUser().requestConfluence` against `POST /wiki/api/v2/pages`. Issue search uses `POST /rest/api/3/search/jql`, because the old `/rest/api/3/search` endpoint has been removed.
- Grouping, audience text, Markdown, and Confluence storage XHTML live in plain TypeScript under `src/core`. Vitest covers them without Forge credentials. GitHub Actions runs ESLint, `tsc`, Vitest, the offline demo, and `@forge/manifest` schema validation.
- Where a model would help the phrasing, the core takes an optional rewriter. The default rewriter is rules: drop `[INTERNAL]` tags and `feat:` prefixes, keep engineering lines literal, and build the executive paragraph from counts and up to three highlights. If a rewriter throws, the rules still run.
- The Rovo agent (`rovo:agent`) does not invent issues. Its prompt tells it to call one of two `action` modules, both `actionVerb: GET`, and to show the Markdown those functions return. Rovo can phrase the conversation. The notes body stays the tested renderer.
- A `rovo:mcp` module lists those same two actions as tools. Other Rovo agents can call them, and Atlassian MCP can expose them after a site admin turns the tools on. The endpoint in the Forge docs is `https://mcp.atlassian.com/forge/<appId>`. The committed app id is a placeholder, so that URL is not live, and external exposure has not been enabled.
- Scopes are `read:jira-work`, `read:confluence-space.summary`, and `write:confluence-content`. There is no external-fetch permission, so the app does not send issue text off Atlassian and stays in the Runs on Atlassian shape. `forge eligibility` still has to be run by someone who is logged in. It has not been run for this repository.
- The offline demo parses the same search-page shape the Jira client parses, including a second page and a `nextPageToken`, then calls `createReleaseNotes`.

## Challenges

- The app had to be useful with no Atlassian credentials in the repository or in CI. That pushed every interesting behaviour into pure functions, with Forge limited to fetching JSON and returning it. The demo recording has the same constraint: it plays sample fixtures instead of a live site.
- Jira Cloud’s issue search moved to `/rest/api/3/search/jql` and token pagination. The client follows `nextPageToken` and stops at 200 issues so a wide JQL query cannot blow the Rovo action payload (the platform caps action data at 5 MB).
- Customer text and engineering text want opposite things from the same summary. One renderer keeps the raw summary for engineering and tidies a copy for everyone else, instead of asking a model to do it and then hoping CI can run that model.
- Confluence storage is XML. Issue summaries are escaped, and the publish path rebuilds the page on the server from sanitized fields so the browser cannot submit a storage body of its own.
- Rovo will happily answer from the prompt if the prompt is vague. The agent instructions say to call an action before talking about issues, and to treat an `error` field as the answer when the project or version is missing.
- A real app id cannot be committed. The manifest ships with a placeholder and a TODO. `forge register` is a manual step for the account owner.
- The Confluence v2 REST docs list granular scopes, while Forge’s scope guide still recommends the classic scopes those APIs were built with. The manifest uses the three classic scopes. The README records the granular fallback if a site rejects them.

## Accomplishments

- The project page and the Rovo agent share one notes engine, so chat and the page cannot drift into two formats.
- The default path needs no AI quota, no egress, and no secrets. `npm test` and `npm run demo` both run the core without an Atlassian login.
- Publishing is one extra step on a real site, and the page is the same draft the user just read. The offline demo builds that payload and stops, which keeps the recording honest about what has not been installed.
- An empty match and a result past 200 issues are explicit in every audience. Permission failures, a missing project or version, and a duplicate Confluence title return a next step. Those paths are unit-tested. They have not been clicked through on a site.

## What we learned

- A Forge app can be reviewed before anyone has a site, if the product behaviour lives in functions that take data instead of calling `api.asUser()` themselves. The resolver and the Rovo actions are thin on purpose.
- Search pagination is part of the product. A second page of issues has to show up in the notes, and the draft has to say when the 200-issue cap is hit.
- One summary cannot serve both readers. Stripping `[INTERNAL]` and `feat:` from the engineering line would hide what the team actually wrote. Leaving those prefixes in the customer line would publish internal tags.
- The manifest’s app id, the install link, and a live eligibility check are account steps. Putting a placeholder id in git is safer than inventing a deployment that did not happen.

## What’s next

- An opt-in rewriter using Atlassian’s in-platform Forge LLM, still behind the same interface, so a site without the model keeps today’s sentences. No third-party model API, so Runs on Atlassian stays intact.
- A “since the previous released version” control that picks the baseline from the version list instead of asking for a name.
- Publish into an existing page (replace the body) when the title already exists, instead of failing on a duplicate title.
- A Jira automation trigger when a version is released, posting the executive paragraph as a comment or creating the Confluence page. That action would be explicit and permission-checked. It is not in this MVP.
- Locale-aware section headings.

## Built with

Atlassian Forge, Forge UI Kit, Jira Cloud REST API v3, Confluence Cloud REST API v2, Rovo (`rovo:agent`, `action`, and `rovo:mcp`), TypeScript, Vitest, ESLint, GitHub Actions.

## Judging checklist

Checked against the [overview](https://codegeist2026.devpost.com/) and the [official rules](https://codegeist2026.devpost.com/rules) on 12 November 2026. Stage One is pass/fail on theme fit and use of Forge. Stage Two scores five criteria at 20% each. One submission can win one grand prize and one bonus prize.

### Category and bonus prizes

Select **Apps for Software Teams**. The audience is a team shipping a Jira fix version and writing the notes engineering, customers, and a lead each need.

| Bonus | Select? | Where the project satisfies it |
| --- | --- | --- |
| Best Agents — Rovo / assignable agents | Yes | `manifest.yml` module `rovo:agent` (`release-scribe-agent`) with actions `draft-release-notes` and `changes-since-version`, both `actionVerb: GET`. Handlers are `src/actions/releaseActions.ts`. The prompt says to call an action and to treat an `error` field as the answer. |
| Best app with Atlassian MCP | Yes | `manifest.yml` module `rovo:mcp` (`release-scribe-mcp`) lists those two actions as tools. Forge serves them on Atlassian MCP after install, once a site admin enables the tools. |
| Best apps with Teamwork Graph integration | No | There is no Teamwork Graph module and no Teamwork Graph API call. |
| Best Marketplace published app | No | There is no Marketplace listing and no review ticket. |

MCP write-up for the form: two read-only tools draft notes for one fix version and summarise issues fixed after a baseline version. Both call the tested renderer and run as the invoking user. The Forge docs give the endpoint as `https://mcp.atlassian.com/forge/<appId>`, using the UUID from the registered app id. This repository still has the placeholder id, so that URL is not live.

### Stage One and required submission fields

- [x] Forge app with `manifest.yml` and Forge modules (`jira:projectPage`, `rovo:agent`, `action`, `function`, `rovo:mcp`).
- [x] Integrates Jira, Confluence, and Rovo. No `permissions.external` block.
- [x] English description of the features (this file) and install instructions ([README.md](README.md), “Deploy & verify on your own Atlassian site”).
- [x] Technology requirement: Forge on `nodejs24.x`; Jira Cloud REST (`POST /rest/api/3/search/jql`, projects, versions); Confluence v2 create page; Rovo agent plus MCP tools over the same actions.
- [ ] Devpost registration and a completed submission form before 22 December 2026, 12:00pm PST.
- [ ] Installation link. Judges must be able to install the app. Create it with Sharing distribution after `forge deploy -e production`.
- [ ] Public YouTube video under five minutes, showing the project functioning. The committed file is 2 minutes 47 seconds and shows sample data in a terminal. A site recording is the footage the presentation criterion asks for.

### Stage Two

- [x] **Technological implementation (20%).** The project page, resolver, token-paged Jira search, Confluence publish, Rovo agent, and MCP tools share `src/core`. CI runs ESLint, `tsc`, Vitest, the offline demo, and `@forge/manifest` schema validation. `forge lint` and `forge eligibility` still need a logged-in CLI.
- [x] **Design (20%).** Three audiences, copyable Markdown, and publish. An empty match names the next step (`EMPTY_RELEASE_GUIDANCE` in `src/core/notes.ts`). A result over 200 issues says so in every audience. Jira 401/403/404/429 and a duplicate Confluence title become a specific message (`src/core/errors.ts`), including Confluence v2’s `errors` array. These paths are unit-tested. They have not been exercised on a site.
- [x] **Potential impact (20%).** The problem is the night-before rewrite of one fix version into three documents that drift from the issues. See Inspiration. The draft is the issue list, grouped, with internal tags kept for engineering and removed for customers.
- [x] **Innovation / idea (20%).** The sentences are rule-based, so CI, the offline demo, and production render the same notes. Rovo phrases the chat around that Markdown. The agent instructions say to call an action rather than invent keys.
- [ ] **Presentation (20%).** This file is the pitch: problem, audience, and why it matters. The video file exists, is under five minutes, and has captions. The public YouTube URL, and footage of the installed Jira page, are still open.

### Still requires a live Atlassian account

None of these have been done for this repository.

- [ ] Create an Atlassian account and an API token, then install the Forge CLI (`npm install -g @forge/cli@latest`) and run `forge login`.
- [ ] Provision the Codegeist development site with `forge site provision`. Confirm Jira, Confluence (`/wiki`), and Rovo Chat load. Install with `forge install --demo-site`. A site you already control also works: `forge install --site your-site.atlassian.net --product jira --environment development`.
- [ ] From this directory, run `forge register` and let it replace the placeholder `app.id`. Do not commit that id.
- [ ] Run `forge lint`, then `forge deploy -e development`, and install. Approve the consent screen (`read:jira-work`, `read:confluence-space.summary`, `write:confluence-content`).
- [ ] On that site, run the README checks: a draft, the three audiences, a published page, the two Rovo prompts, an empty fix version, and a second publish with the same title.
- [ ] Run `forge eligibility` and record whether Runs on Atlassian passes. The manifest has no external-fetch permission. Eligibility has not been run.
- [ ] Screenshots for Devpost, taken on the site: the project page with a draft, the Confluence page, and a Rovo reply. Do not present the offline terminal frames as a live install.
- [ ] For the MCP bonus, in Atlassian Administration open the installed app and enable the two tools. Confirm a client can list them at `https://mcp.atlassian.com/forge/<registered-app-id>`. This repository cannot demonstrate that step.
- [ ] For the judge install link, `forge deploy -e production`, set distribution to Sharing in the developer console, and paste that link into Devpost.
- [ ] Upload a public YouTube video and paste the URL. Prefer a site recording from [docs/demo-script.md](docs/demo-script.md). The offline file ([demo/release-scribe-demo.mp4](demo/release-scribe-demo.mp4), captions in [demo/release-scribe-demo.srt](demo/release-scribe-demo.srt)) is already rendered with text-to-speech and no face. Regenerate it with `demo/render_video.sh` if the script changes.
- [ ] Register the project on Devpost. Select Apps for Software Teams. Select the Agents bonus and the MCP bonus. Leave Teamwork Graph and Marketplace unselected. Paste this file.
- [ ] Marketplace, only if you later want that bonus: publish the app or submit it for listing, then add the listing URL or the review ticket. There is no listing now.
