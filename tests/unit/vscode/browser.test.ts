// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
    INTEGRATED_BROWSER_COMMAND,
    SalesforceBrowser,
    type OpenOrgSetting,
} from '../../../vscode/src/browser';

function setup(options: { setting?: OpenOrgSetting; commands?: string[]; executeFails?: boolean }) {
    const executeCommand = vi.fn(async () => {
        if (options.executeFails) throw new Error('command not found');
    });
    const openExternal = vi.fn(async () => true);
    const browser = new SalesforceBrowser<string>({
        getSetting: () => options.setting,
        getCommands: async () => options.commands ?? [],
        executeCommand,
        openExternal,
        parse: url => `uri:${url}`,
    });
    return { browser, executeCommand, openExternal };
}

const URL = 'https://acme.my.salesforce.com/secur/frontdoor.jsp?otp=x';

describe('SalesforceBrowser', () => {
    it('opens in the integrated browser when VS Code has it', async () => {
        const { browser, executeCommand, openExternal } = setup({
            commands: ['other', INTEGRATED_BROWSER_COMMAND],
        });
        await expect(browser.open(URL)).resolves.toBe('integrated');
        // The command reads a non-string argument as options and opens a blank tab
        expect(executeCommand).toHaveBeenCalledWith(INTEGRATED_BROWSER_COMMAND, URL);
        expect(openExternal).not.toHaveBeenCalled();
    });

    it('uses the system browser on VS Code versions without it', async () => {
        const { browser, executeCommand, openExternal } = setup({ commands: ['other'] });
        await expect(browser.open(URL)).resolves.toBe('external');
        expect(executeCommand).not.toHaveBeenCalled();
        expect(openExternal).toHaveBeenCalledWith(`uri:${URL}`);
    });

    it('uses the system browser when the setting asks for it', async () => {
        const { browser, executeCommand, openExternal } = setup({
            setting: 'externalBrowser',
            commands: [INTEGRATED_BROWSER_COMMAND],
        });
        await expect(browser.target()).resolves.toBe('external');
        await browser.open(URL);
        expect(executeCommand).not.toHaveBeenCalled();
        expect(openExternal).toHaveBeenCalledOnce();
    });

    it('falls back to the system browser when the command fails', async () => {
        const { browser, openExternal } = setup({
            commands: [INTEGRATED_BROWSER_COMMAND],
            executeFails: true,
        });
        await expect(browser.open(URL)).resolves.toBe('external');
        expect(openExternal).toHaveBeenCalledWith(`uri:${URL}`);
    });
});
