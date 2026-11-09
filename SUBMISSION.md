# Release Scribe — Codegeist 2026

Author: David Zhu.

Tagline: Release notes from a Jira fix version, written for engineering, customers, and executives.

Paste the sections below into the [Codegeist 2026](https://codegeist.devpost.com) form. Deadline: 22 December 2026. The install link and the video URL are still open. This repository has not been deployed to an Atlassian site, and it does not report user counts or other usage metrics.

Suggested links once the manual steps below are done:

- Install link: the Sharing link from the developer console after `forge deploy -e production`.
- Video: an unlisted upload, under five minutes. Record `npm run demo` with [demo/narration.md](demo/narration.md). No face and no human voice.

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
- Registers a Rovo agent with two actions: draft the notes for a version, and summarise what changed since a version.

The draft is deterministic. The same issues produce the same sentences, with or without Rovo, and with or without a network call to a model.

`npm run demo` runs that pipeline on sample Jira issues in `demo/fixtures/atlas-board.json` and writes the notes under `demo/output/`. That run does not contact an Atlassian site.

## How we built it

Release Scribe is an Atlassian Forge app on the Node.js 24 runtime.

- The project page is UI Kit (`jira:projectPage`, `render: native`). It calls a Forge resolver.
- The resolver reads projects, versions, and issues with `api.asUser().requestJira`, and creates pages with `api.asUser().requestConfluence` against `POST /wiki/api/v2/pages`. Issue search uses `POST /rest/api/3/search/jql`, because the old `/rest/api/3/search` endpoint has been removed.
- Grouping, audience text, Markdown, and Confluence storage XHTML live in plain TypeScript under `src/core`. Vitest covers them without Forge credentials. GitHub Actions runs ESLint, `tsc`, Vitest, the offline demo, and `@forge/manifest` schema validation.
- Where a model would help the phrasing, the core takes an optional rewriter. The default rewriter is rules: drop `[INTERNAL]` tags and `feat:` prefixes, keep engineering lines literal, and build the executive paragraph from counts and up to three highlights. If a rewriter throws, the rules still run.
- The Rovo agent (`rovo:agent`) does not invent issues. Its prompt tells it to call one of two `action` modules, both `actionVerb: GET`, and to show the Markdown those functions return. Rovo can phrase the conversation. The notes body stays the tested renderer.
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

Atlassian Forge, Forge UI Kit, Jira Cloud REST API v3, Confluence Cloud REST API v2, Rovo (`rovo:agent` and `action`), TypeScript, Vitest, ESLint, GitHub Actions.

## Checklist of remaining manual steps

None of these have been done for this repository.

- [ ] Create an Atlassian developer account, if you do not already have one.
- [ ] Install the Forge CLI (`npm install -g @forge/cli@latest`) and run `forge login`.
- [ ] From this directory, run `forge register` and let it replace the placeholder `app.id`. Do not commit that id.
- [ ] Run `forge deploy -e development`.
- [ ] Run `forge install` on a development site you control (`--site your-site.atlassian.net --product jira --environment development`).
- [ ] On that site, confirm the project page, a draft, and (when Confluence is on the same site) a published page. The checks are in the README section “Deploy & verify on your own Atlassian site”.
- [ ] Register the project on Devpost for Codegeist 2026.
- [ ] Record the video from `npm run demo` using [demo/narration.md](demo/narration.md). Text-to-speech, captions, no face. Or, after the install above, record the optional live-site shots in [docs/demo-script.md](docs/demo-script.md).
- [ ] For the judge install link, `forge deploy -e production`, set distribution to Sharing in the developer console, and paste that link into Devpost.
- [ ] Paste the video URL into Devpost.
