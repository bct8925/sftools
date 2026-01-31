# sftools

Developer tools for Salesforce, built as a Chrome extension.

**Website:** [sftools.dev](https://sftools.dev)

## Features

- **SOQL Query Editor** - Write and execute SOQL queries with syntax highlighting, tabbed results, and bulk query export
- **Anonymous Apex** - Execute Apex code with output display and execution history
- **REST API Explorer** - Make REST API calls to any Salesforce endpoint with a built-in Monaco editor
- **Event Streaming** - Subscribe to Platform Events, Change Data Capture, and PushTopics via an optional native proxy
- **Schema Browser** - Browse object metadata, fields, and relationships
- **Record Viewer** - View and edit individual record fields directly from any Salesforce page
- **Utility Tools** - Debug log management, flow cleanup, and more
- **Multi-Org Support** - Connect to multiple Salesforce orgs and switch between them
- **Dark Mode** - Light and dark themes with system preference detection

## Installation

Install from the [Chrome Web Store](https://sftools.dev) or load the extension manually:

1. Clone this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions/` and enable Developer mode
4. Click "Load unpacked" and select the repository root

## Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/bct8925/sftools/issues).

## Privacy

See the [Privacy Policy](https://sftools.dev/privacy) for details on how sftools handles your data.

## License

This project is licensed under the [MIT License with Commons Clause](LICENSE). You are free to use, modify, and redistribute the software with attribution, but you may not sell it.
