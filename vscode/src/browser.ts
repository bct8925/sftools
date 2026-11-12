// Opens Salesforce pages in VS Code's integrated browser when it exists,
// otherwise in the system browser.

/** VS Code's integrated browser (1.109+, desktop). Takes the URL as a Uri. */
export const INTEGRATED_BROWSER_COMMAND = 'workbench.action.browser.open';

export type BrowserTarget = 'integrated' | 'external';
export type OpenOrgSetting = 'integratedBrowser' | 'externalBrowser';

export interface BrowserDeps<U> {
    getSetting(): OpenOrgSetting | undefined;
    getCommands(): Thenable<string[]>;
    executeCommand(command: string, uri: U): Thenable<unknown>;
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

    async open(url: string): Promise<BrowserTarget> {
        const uri = this.deps.parse(url);
        if ((await this.target()) === 'integrated') {
            try {
                await this.deps.executeCommand(INTEGRATED_BROWSER_COMMAND, uri);
                return 'integrated';
            } catch {
                // An older or web build without the browser; use the system one
            }
        }
        await this.deps.openExternal(uri);
        return 'external';
    }
}
