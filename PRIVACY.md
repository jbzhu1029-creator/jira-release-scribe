# Privacy Policy

**Release Scribe**  
Author: David Zhu  
Contact: [jbzhu1029-an85sp@mail.grokbot.com](mailto:jbzhu1029-an85sp@mail.grokbot.com)  
Effective date: 19 November 2026

## Who we are

Release Scribe is an Atlassian Forge app for Jira and Confluence. It drafts release notes from issues that already exist on the customer's Atlassian Cloud site and can publish those notes as a Confluence page.

## Where data is processed

The app runs entirely on the Atlassian Forge platform, inside the customer's Atlassian Cloud site. It does not call third-party services, declare any external network egress, or send issue text or other data off the Atlassian platform.

## Personal data

Release Scribe does not store personal data outside the customer's Atlassian site. It reads Jira issues, projects, and versions with the signed-in user's permissions, and it writes a Confluence page only when that user chooses to publish. Any content it creates stays in that customer's Jira or Confluence instance.

The app does not collect analytics, usage telemetry, cookies, or advertising data.

## Permissions

The app requests these Atlassian scopes:

- `read:jira-work` — to search issues and list projects and versions
- `read:confluence-space.summary` — to list spaces the user can publish to
- `write:confluence-content` — to create a release-notes page when the user publishes

Requests run as the invoking user (`api.asUser()`). The app only sees issues and spaces that person can already access.

## Contact

Questions about this policy can be sent to [jbzhu1029-an85sp@mail.grokbot.com](mailto:jbzhu1029-an85sp@mail.grokbot.com).
