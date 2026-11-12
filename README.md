# Release Scribe

Release Scribe turns a Jira fix version, or any JQL query, into release notes a stakeholder can read. A Jira project page groups the issues and drafts three versions of the notes: internal engineering, customer-facing, and a one-paragraph executive summary. The same draft can be copied as Markdown or published as a Confluence page. A Rovo agent answers “draft release notes for version X” and “what changed since version Y” by calling the same code.

The wording is rule-based. It does not call an external model, so the draft is the same in CI, offline, and in production. Rovo can phrase the chat around the returned Markdown. The notes themselves stay reproducible.

Built for [Codegeist 2026](https://codegeist2026.devpost.com) (Devpost deadline 22 December 2026, 12:00pm PST). Author: David Zhu.

Judges need an install link and a public demo video under five minutes. This repository has not been deployed to an Atlassian site. The offline recording is [demo/release-scribe-demo.mp4](demo/release-scribe-demo.mp4) (2 minutes 47 seconds, captions in [demo/release-scribe-demo.srt](demo/release-scribe-demo.srt)). It shows the notes pipeline on sample data, not an installed Forge app. Uploading it to YouTube as a public video is still a manual step. The script is [demo/narration.md](demo/narration.md). Category, bonus prizes, and the remaining account steps are in [SUBMISSION.md](SUBMISSION.md).

## What the app does

On a Jira project page named **Release Scribe**:

1. Pick the open project (or another project you can browse) and a fix version, or switch to a JQL query.
2. See matching issues grouped into **Features**, **Improvements**, **Bug fixes**, and **Other**.
3. Read the three audiences, plus the full Markdown document, in a read-only field you can select and copy.
4. Choose a Confluence space and publish the notes as a page. The page is created with the Confluence v2 REST API through Forge `requestConfluence`.

In Rovo chat, the **Release Scribe** agent has two read-only actions. The same actions are listed on a `rovo:mcp` module so other agents, and Atlassian MCP after a site admin enables the tools, can call them:

| Action | What it answers |
| --- | --- |
| Draft release notes | Notes for one fix version, optionally for a single audience. |
| Changes since version | Issues whose fix version is ordered after a baseline version (`fixVersion >` in JQL). |

Both actions run as the person who invoked them, so they only see issues that person can already open.

## Architecture

```
Jira project page (UI Kit)          Rovo agent
        |                                |
        | invoke                         | action
        v                                v
   Forge resolver                  Forge functions
        \                              /
         v                            v
              Jira + Confluence calls
              (api.asUser, no egress)
                       |
                       v
              src/core  (pure TypeScript)
              group, summarise, Markdown, storage HTML
```

| Path | Role |
| --- | --- |
| `src/core` | Grouping, audience text, Markdown, Confluence storage XHTML, JQL quoting, response parsing. No Atlassian credentials and no Forge imports. |
| `src/services/createReleaseNotes.ts` | Runs a JQL search through an injected client, then calls the core. |
| `src/jira`, `src/confluence` | Forge product requests. Search uses `POST /rest/api/3/search/jql`. Pages are created with `POST /wiki/api/v2/pages`. |
| `src/resolvers` | UI Kit resolver for the project page. |
| `src/actions/releaseActions.ts` | Rovo action handlers. The MCP module calls these same functions. |
| `src/frontend` | UI Kit page (`render: native`). |
| `manifest.yml` | Modules (`jira:projectPage`, `rovo:agent`, `rovo:mcp`, actions), runtime, and scopes. Validated in CI with `@forge/manifest`. |

Issue types are grouped with fixed rules: names containing “bug”, “defect”, or “regress” are bug fixes; stories, features, and epics are features; improvements and enhancements stay improvements; everything else, including tasks and sub-tasks, is Other. Customer lines drop leading tags such as `[INTERNAL]` and conventional-commit prefixes such as `feat:`. Engineering lines keep the issue key, status, and priority. The executive paragraph is one sentence of counts plus up to three highlights.

An optional `SummaryRewriter` can rephrase customer and executive lines. The default rewriter is the rule above. A model-backed rewriter can be passed into `generateReleaseNotes` later. It is not wired up, and a rewriter that throws falls back to the rules, so the app still renders with no AI entitlement and no third-party HTTP call.

At most 200 issues are included. Engineering, customer, and executive copy each say when that cap is hit, and the page shows the same warning. An empty match says that nothing matched and tells you to confirm the version or switch to JQL, instead of publishing a heading with no explanation. Custom JQL is limited to 2,000 characters. Publishing rebuilds the page from sanitized issue fields, so the storage body cannot carry raw HTML from the browser. A duplicate Confluence title, a 401, a 403, a 404, and a 429 become a short next step rather than a raw status line. Confluence v2 returns errors as an array of objects; that shape is read too.

## Scopes and runtime

`manifest.yml` requests only:

| Scope | Why |
| --- | --- |
| `read:jira-work` | Projects, fix versions, and issue search. |
| `read:confluence-space.summary` | List spaces to publish into. |
| `write:confluence-content` | Create the release-notes page. |

There is no `permissions.external` block, so the app makes no third-party network calls. That is the Runs on Atlassian posture. After you log in, confirm with `forge eligibility`.

The runtime is `nodejs24.x` on `arm64`, which is the runtime the Forge manifest schema recommends for standard Atlassian cloud. Atlassian Government Cloud does not offer `arm64`; set `architecture: x86_64` before deploying there.

The Confluence v2 REST docs also name the granular scopes `read:space:confluence` and `write:page:confluence`. Classic scopes are what Forge recommends where they exist, and they are the ones declared here. If a create-page call returns a scope error, add those two granular scopes and rerun the deploy and `forge install --upgrade` commands in the deploy section below.

## Develop without an Atlassian login

Requirements: Node.js 20 or newer.

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run validate-manifest
npm run demo -- --fast
```

`npm test` runs Vitest. It does not read the network and does not need Forge credentials. `validate-manifest` checks `manifest.yml` with the current `@forge/manifest` schema (the package Atlassian generates from the Forge manifest schema).

GitHub Actions runs lint, typecheck, tests, the offline demo, and manifest validation on every pull request.

## Offline demo

`npm run demo` runs the release-notes pipeline on the sample Jira search in `demo/fixtures/atlas-board.json`. It prints nine scenes and writes Markdown under `demo/output/`. No Forge login and no network call.

The paced run is what you screen-record. Scene pauses match [demo/narration.md](demo/narration.md) (about 2 minutes 50 seconds). `npm run demo -- --fast` skips the pauses. `DEMO_PAUSE_MS` replaces every pause with one number of milliseconds when a text-to-speech track needs more time.

Generated files in `demo/output/` are gitignored.

## Re-render the demo video

[demo/release-scribe-demo.mp4](demo/release-scribe-demo.mp4) is a terminal recording of the manifest, `src/core`, and `npm run demo` on `demo/fixtures/atlas-board.json`. Captions are burned in, and the same cues are in [demo/release-scribe-demo.srt](demo/release-scribe-demo.srt). The voice is offline text-to-speech. The pictures are sample data on this machine. The app has not been installed on an Atlassian site.

From the repo root, with ffmpeg, ttyd, VHS, Python 3, Node.js 20+, and JetBrains Mono:

```bash
demo/render_video.sh
```

The script reads the Voice lines in [demo/narration.md](demo/narration.md). It speaks them with Piper (the en_US lessac voice, cached under `demo/work/`) and falls back to espeak-ng if that download fails. [demo/release-scribe.tape](demo/release-scribe.tape) is the VHS tape the script writes and records. `demo/work/` is scratch space and is gitignored. Scene headings in the narration are the default `npm run demo` pauses. The renderer holds each scene for its voice line.

## Deploy & verify on your own Atlassian site

The committed app id is a placeholder. This repository has not been deployed. The commands below are what you run on a site you control.

```yaml
# TODO: not a registered app. `forge register` replaces this.
id: ari:cloud:ecosystem::app/00000000-0000-4000-8000-000000000000
```

Do not commit the id `forge register` writes back. Keep that change local, or tell git to skip it (`git update-index --assume-unchanged manifest.yml`) after registering.

You need an Atlassian account that can deploy Forge apps, a Jira Cloud site where you can install apps, and Node.js 20 or newer. Confluence on that same site is required only when you want to publish a page. Run the commands from this directory, the one that contains `manifest.yml`.

```bash
npm install -g @forge/cli@latest
forge login
forge register
forge lint
forge deploy -e development
forge install --site your-site.atlassian.net --product jira --environment development
```

Replace `your-site` with the hostname you logged into. Codegeist also provisions a free site with Jira, Confluence, and Rovo. From this directory, after `forge login`:

```bash
forge site provision
forge install --demo-site
```

`forge site provision` prints the site URL. You can only have one provisioned site at a time. Approve the consent screen. It lists `read:jira-work`, `read:confluence-space.summary`, and `write:confluence-content`.

`forge lint` needs the login above. CI already validates the manifest schema offline. `forge deploy` bundles the TypeScript UI and the functions. There is no separate frontend build.

If Forge asks the user to grant the app access the first time the page loads, accept that grant. `api.asUser()` uses it.

### What to check

1. `forge deploy -e development` finishes on the development environment.
2. Open a Jira project on that site. **Release Scribe** is in the project apps navigation.
3. Choose the open project and a fix version that has issues. The page shows the JQL it will run before you draft.
4. Click **Draft release notes**. Counts appear for Features, Improvements, Bug fixes, and Other.
5. The Engineering tab includes issue keys, status, and priority. The Customer tab omits keys and strips leading tags such as `[INTERNAL]` and prefixes such as `feat:`. The Executive tab is one paragraph of counts and highlights.
6. The Markdown tab is the full document. Select it and copy it.
7. With Confluence on the same site, choose a space, keep or edit the page title, and click **Publish page**. The new page has the same headings. A summary that contains `<` or `&` shows up as text.
8. Open Rovo chat and select the **Release Scribe** agent. Rovo has to be available on the site. Try these, with your own project key and version names:
   - `Draft release notes for version 1.4.0 of ATLAS`
   - `What changed in ATLAS since version 1.3.0?`
   - `Just the executive summary`
9. The replies quote the markdown returned by the action. Publishing stays on the project page. The agent prompt tells it not to claim a page was created.
10. Run `forge eligibility` and read whether the app meets Runs on Atlassian. The manifest has no `permissions.external` block. Eligibility has not been run for this repository, because the app has not been deployed.
11. Open a fix version that has no issues. Expect the message “No issues matched”, and the same sentence in the customer and engineering notes. The customer section does not invent changes.
12. A result larger than 200 issues says the draft stops there, on the page and in every audience. The cap is what the code does. This repository has not run that query on a site.
13. Publish, then publish again with the same page title. Expect a message that the title already exists. Edit the title and publish again.
14. If Jira returns 403, the page says you do not have permission to browse those issues. The query runs as the person who clicked Draft.

### Atlassian MCP tools

After the app is installed, external MCP exposure stays off. A site admin turns the tools on in Atlassian Administration: Apps, Sites, the site, Connected apps, this Forge app, then the tool list. The endpoint is `https://mcp.atlassian.com/forge/<appId>`, where `<appId>` is the UUID from the registered `app.id`. The placeholder id in git is not that UUID. This step has not been done for this repository.

Development and production are different installs.

After a scope change, deploy again and upgrade the install:

```bash
forge deploy -e development
forge install --upgrade --site your-site.atlassian.net --product jira --environment development
```

### Install link for judges

A development install is not a link judges can open. When you want that link:

```bash
forge deploy -e production
```

In the [developer console](https://developer.atlassian.com/console/myapps/), set distribution to **Sharing** and copy the installation link into the Devpost form. Production has not been deployed from this repository.

Atlassian Government Cloud does not offer the `arm64` architecture declared here. Set `architecture: x86_64` before deploying there.

If a create-page call returns a scope error, add the granular scopes `read:space:confluence` and `write:page:confluence`, deploy again, and run `forge install --upgrade` with the site, product, and environment flags above.

## Project layout for the submission

- [SUBMISSION.md](SUBMISSION.md) — Devpost text, the judging checklist, and the steps that still need an Atlassian account.
- [Offline demo narration](demo/narration.md) — text-to-speech script for `npm run demo`. No face, no human voice, no Atlassian account.
- [Offline demo video](demo/release-scribe-demo.mp4) — the recording of that script, with [captions](demo/release-scribe-demo.srt). It shows sample data, not an installed app.
- [Live-site demo script](docs/demo-script.md) — shots to record after install. The presentation criterion asks for the project functioning on Forge.

## Security

- Jira and Confluence are called with `api.asUser()`, including from Rovo actions, so the app sees only what the invoking person can see. Authorization does not trust an issue key or project key supplied by the model; the product API enforces browse permission.
- Project keys used in a URL path are checked against `^[A-Z][A-Z0-9]{1,9}$` before the request. Version names are quoted and escaped inside JQL.
- Page titles are length-capped. Issue summaries written into Confluence storage are XML-escaped. The publish handler rebuilds the page from sanitized fields instead of accepting HTML from the browser.
- No tokens, site names, or real app ids belong in git.

## License

[MIT](LICENSE)
