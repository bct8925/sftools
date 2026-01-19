# Permission Justifications

| Permission | Justification |
|------------|---------------|
| `sidePanel` | The extension UI opens in Chrome's side panel. |
| `activeTab` | Used for two features: (1) Reading the current tab URL when user right-clicks the extension icon to open the Record Viewer, extracting record ID and object type. (2) Reading the current Salesforce domain when adding a new connection, to set the correct login URL. No content is injected. |
| `storage` | Stores OAuth tokens, connection info (instance URLs, labels), and user preferences (theme). Data stays in Chrome storage and is not transmitted externally. |
| `contextMenus` | Adds "View/Edit Record" option when right-clicking the extension icon on Salesforce record pages. |
| `notifications` | Shows confirmation messages for actions like record updates or errors parsing URLs. |
| `nativeMessaging` | Communicates with an optional locally-installed proxy for Platform Events streaming (gRPC) and PushTopics (CometD). The proxy runs on localhost. Not required for core functionality. |
