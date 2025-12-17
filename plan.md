I have 2 existing chrome extensions in this folder. I want to combine them into one single chrome extension called sftools (dev tools for Salesforce).
- Use the Vite build process from the salesfaux/ project
- Use the UI style from apiTester/ and salesfaux/, which is Salesforce-like but all local CSS without any imported style libraries
- The new UI should be a list of tabs, one for each tool (REST API, )
- For longer text inputs/outputs like JSON params and response outputs, use the Monaco editor as currently used in the salesfaux/ project (the reason we have the Vite build process)
- Combine all the extension manifests into one for sftools, using the "key" and "oauth" params
- Do fetch calls using the background script from salesfaux/, but refactor to make it cleaner 