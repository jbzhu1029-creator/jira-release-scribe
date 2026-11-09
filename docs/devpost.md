# Devpost draft — Release Scribe

Paste the sections below into the Codegeist 2026 submission. Add the production install link and the YouTube URL after the manual steps in the README. The video must be under five minutes. A script that does not need a face or a human voice is in [demo-script.md](demo-script.md).

Suggested tagline: Release notes from a Jira fix version, written for engineering, customers, and executives.

## Inspiration

Shipping a version is a Jira filter and a blank page. The people who need the notes are not looking at the same thing: engineering wants keys and priorities, customers want what changed for them, and a lead wants one paragraph. Teams rewrite that three times, usually the night before the release, and the Confluence page drifts from the issues that actually shipped.

Release Scribe starts from the fix version (or a JQL query, when the version is not the whole story) and produces all three drafts from the same issues. Publishing puts that draft on a Confluence page without another copy-paste. A Rovo agent answers the same questions in chat, which is how people already ask “what shipped?”.

## What it does

- Adds a **Release Scribe** page to each Jira project.
- Lets someone pick a project and a fix version, or paste a JQL query.
- Groups the issues into Features, Improvements, Bug fixes, and Other.
- Drafts three audiences: internal engineering (keys, status, priority), customer-facing (no keys, internal tags stripped), and a one-paragraph executive summary.
- Shows the full notes as Markdown that can be selected and copied.
- Publishes the notes to a chosen Confluence space.
- Registers a Rovo agent with two actions: draft the notes for a version, and summarise what changed since a version.

The draft is deterministic. The same issues produce the same sentences, with or without Rovo, and with or without a network call to a model.

## How we built it

Release Scribe is an Atlassian Forge app on the Node.js 24 runtime.

- The project page is UI Kit (`jira:projectPage`, `render: native`). It calls a Forge resolver.
- The resolver reads projects, versions, and issues with `api.asUser().requestJira`, and creates pages with `api.asUser().requestConfluence` against `POST /wiki/api/v2/pages`. Issue search uses `POST /rest/api/3/search/jql`, because the old `/rest/api/3/search` endpoint has been removed.
- Grouping, audience text, Markdown, and Confluence storage XHTML live in plain TypeScript modules under `src/core`. Vitest covers them without Forge credentials, which is also what CI runs.
- Where a model would help the phrasing, the core takes an optional rewriter. The default rewriter is rules: drop `[INTERNAL]` tags and `feat:` prefixes, keep engineering lines literal, and build the executive paragraph from counts and up to three highlights. If a rewriter throws, the rules still run.
- The Rovo agent (`rovo:agent`) does not invent issues. Its prompt tells it to call one of two `action` modules, both `actionVerb: GET`, and to show the Markdown those functions return. Rovo can phrase the conversation. The notes body stays the tested renderer.
- Scopes are `read:jira-work`, `read:confluence-space.summary`, and `write:confluence-content`. There is no external-fetch permission, so the app does not send issue text off Atlassian and stays in the Runs on Atlassian shape.
- GitHub Actions runs ESLint, `tsc`, Vitest, and `@forge/manifest` schema validation.

## Challenges

- The app had to be useful with no Atlassian credentials in the repository or in CI. That pushed every interesting behaviour into pure functions, with Forge limited to fetching JSON and returning it.
- Jira Cloud’s issue search moved to `/rest/api/3/search/jql` and token pagination. The client follows `nextPageToken` and stops at 200 issues so a wide JQL query cannot blow the Rovo action payload (the platform caps action data at 5 MB).
- Customer text and engineering text want opposite things from the same summary. One renderer keeps the raw summary for engineering and tidies a copy for everyone else, instead of asking a model to do it and then hoping CI can run that model.
- Confluence storage is XML. Issue summaries are escaped, and the publish path rebuilds the page on the server from sanitized fields so the browser cannot submit a storage body of its own.
- Rovo will happily answer from the prompt if the prompt is vague. The agent instructions say to call an action before talking about issues, and to treat an `error` field as the answer when the project or version is missing.
- A real app id cannot be committed. The manifest ships with a placeholder and a TODO. `forge register` is a manual step for the account owner.
- The Confluence v2 REST docs list granular scopes, while Forge’s scope guide still recommends the classic scopes those APIs were built with. The manifest uses the three classic scopes. The README records the granular fallback if a site rejects them.

## Accomplishments we’re happy with

- A project page and a Rovo agent share one notes engine, so chat and the page cannot drift into two formats.
- The default path needs no AI quota, no egress, and no secrets. `npm test` is the whole demo of the core.
- Publishing is one extra step, not a different document: the page is the same draft the user just read.

## What’s next

- An opt-in rewriter using Atlassian’s in-platform Forge LLM, still behind the same interface, so a site without the model keeps today’s sentences. No third-party model API, so Runs on Atlassian stays intact.
- A “since the previous released version” control that picks the baseline from the version list instead of asking for a name.
- Publish into an existing page (replace the body) when the title already exists, instead of failing on a duplicate title.
- A Jira automation trigger when a version is released, posting the executive paragraph as a comment or creating the Confluence page. That action would be explicit and permission-checked. It is not in this MVP.
- Locale-aware section headings.

## Built with

Atlassian Forge, Forge UI Kit, Jira Cloud REST API v3, Confluence Cloud REST API v2, Rovo (`rovo:agent` and `action`), TypeScript, Vitest, ESLint, GitHub Actions.

## Install and video

- Install link: add the Sharing link from the developer console after `forge deploy -e production`.
- Video: add the YouTube URL. Record from [demo-script.md](demo-script.md). Keep it under five minutes, with captions or an AI voice and no one on camera.
