# Privacy Policy for sftools

**Last Updated:** January 30, 2026

## Overview

sftools is a Chrome browser extension that provides developer tools for Salesforce. This privacy policy explains what data the extension accesses, how it is used, and how it is stored.

## Data Collection and Usage

### What We Collect

sftools collects and stores the following data locally on your device:

1. **Salesforce OAuth Tokens**
   - Access tokens and refresh tokens obtained through Salesforce's standard OAuth 2.0 flow
   - Used solely to authenticate API requests to your Salesforce org(s)

2. **Connection Information**
   - Salesforce instance URLs (e.g., yourorg.my.salesforce.com)
   - Connection labels you assign to identify your orgs
   - Timestamps for when connections were created and last used

3. **User Preferences**
   - Theme preference (light, dark, or system)
   - Saved queries and code snippets (optional feature)

### What We Do NOT Collect

- We do not collect personal information (name, email, address)
- We do not collect browsing history
- We do not collect analytics or usage data
- We do not collect the content of your Salesforce data
- We do not use cookies or tracking technologies

## Data Storage

All data is stored locally on your device using Chrome's built-in storage API (`chrome.storage.local`). Your data:

- Never leaves your device except when communicating directly with Salesforce APIs
- Is not transmitted to any third-party servers
- Is not shared with any third parties
- Is automatically removed when you uninstall the extension

## Third-Party Services

sftools communicates only with Salesforce APIs:

- **Salesforce REST API** - For queries, record operations, and metadata
- **Salesforce Tooling API** - For Apex execution and debug logs
- **Salesforce OAuth Endpoints** - For authentication

No other third-party services receive any data from this extension.

## Optional Local Proxy

sftools includes an optional local proxy feature for advanced streaming capabilities (Platform Events, PushTopics). This proxy:

- Runs entirely on your local machine (localhost)
- Does not transmit data to external servers
- Is not required for core functionality
- Must be manually installed and enabled by the user

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `sidePanel` | Opens the extension in Chrome's side panel |
| `activeTab` | Reads the current tab URL to detect Salesforce login domains for authentication and to enable the "View Record" feature |
| `storage` | Stores your connections, preferences, and cached metadata locally |
| `unlimitedStorage` | Allows caching object metadata for large Salesforce orgs |
| `contextMenus` | Adds "View/Edit Record" to the extension's right-click menu |
| `notifications` | Shows brief confirmations for actions like saving records |
| `nativeMessaging` | Communicates with the optional local proxy for streaming |

## Data Retention

- Data is retained until you remove a connection or uninstall the extension
- You can delete individual connections at any time through Settings
- Uninstalling the extension removes all stored data

## Security

- OAuth tokens are stored using Chrome's secure storage API
- Tokens are only transmitted over HTTPS to Salesforce endpoints
- The extension does not have access to your Salesforce password
- Authorization uses Salesforce's standard OAuth 2.0 flow

## Children's Privacy

sftools is a developer tool intended for professional use. It is not directed at children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this document.

## Contact

If you have questions about this privacy policy or the extension's data practices, please open an issue on our GitHub repository.

---

## Summary

**sftools stores your Salesforce connection information locally on your device. It only communicates with Salesforce APIs. No data is sent to third parties or collected for analytics.**
