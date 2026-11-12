// Opens Salesforce pages in VS Code's integrated browser when it exists,
// otherwise in the system browser.

/**
 * VS Code's integrated browser (1.109+, desktop). Its argument is the URL as a
 * string (or an options object); a Uri is read as options and opens a blank tab.
 */
export const INTEGRATED_BROWSER_COMMAND = 'workbench.action.browser.open';

export type BrowserTarget = 'integrated' | 'external';
export type OpenOrgSetting = 'integratedBrowser' | 'externalBrowser';

export interface BrowserDeps<U> {
    getSetting(): OpenOrgSetting | undefined;
    getCommands(): Thenable<string[]>;
    executeCommand(command: string, url: string): Thenable<unknown>;
    openExternal(uri: U): Thenable<boolean>;
    parse(url: string): U;
}

export class SalesforceBrowser<U> {
    constructor(private readonly deps: BrowserDeps<U>) {}

    /** Where a Salesforce page will open with the current setting and VS Code version */
    async target(): Promise<BrowserTarget> {
        if (this.deps.getSetting() === 'externalBrowser') return 'external';
        const commands = await this.deps.getCommands();
        return commands.includes(INTEGRATED_BROWSER_COMMAND) ? 'integrated' : 'external';
    }

    /** @param systemBrowser - skip the integrated browser even when it's available */
    async open(url: string, systemBrowser = false): Promise<BrowserTarget> {
        if (!systemBrowser && (await this.target()) === 'integrated') {
            try {
                await this.deps.executeCommand(INTEGRATED_BROWSER_COMMAND, url);
                return 'integrated';
            } catch {
                // An older or web build without the browser; use the system one
            }
        }
        await this.deps.openExternal(this.deps.parse(url));
        return 'external';
    }
}
