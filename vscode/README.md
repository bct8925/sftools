# sftools for VS Code

The sftools developer tools (Query, Apex, REST API, Events, Debug Logs, Schema, Data Import, Utils) inside VS Code.

- **Orgs come from the Salesforce CLI.** Every org you've authorized with `sf` is available. New panels start on the workspace's default org (`sf config set target-org`). Use **sftools: Log In to an Org** to add one (runs `sf org login web`).
- **No CORS setup and no local proxy.** Requests go from the extension host straight to Salesforce, and streaming (Platform Events, PushTopics, CDC, debug log watching) is built in.
- **Native editors.** Query, Apex and REST bodies open as VS Code documents beside the tool, with SOQL completions from sftools and syntax highlighting from the Salesforce extensions when you have them. Press Ctrl/Cmd+Enter (or the Run button) to run.

## Requirements

- The Salesforce CLI (`sf`) on your PATH, or set `sftools.sfPath`.

## Commands

Open the command palette and type **sftools**: open the home screen or a specific tool, view/edit a record by Id, refresh orgs, log in to an org, or open an org.

## Side bar and integrated browser

The sftools icon in the activity bar opens sftools in the side bar, like the Chrome side panel. **sftools: Open Org** and links to Salesforce pages open in VS Code's integrated browser (VS Code 1.109 or later, desktop), already signed in through the sf CLI. Set `sftools.openOrgIn` to `externalBrowser` to use your system browser instead; older VS Code versions always use it.

## Building

From the repository root:

```
npm install
npm --prefix vscode install
npm run package:vscode
```

This writes `vscode/sftools.vsix`. Install it with **Extensions: Install from VSIX…**.
