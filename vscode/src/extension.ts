// sftools for VS Code: the sftools tools in webview panels, with orgs from the sf CLI.

import * as vscode from 'vscode';
import { API_VERSION } from '../../src/api/constants';
import { EDITOR_THEME_CHANGED, SF_CLI_ACCESS_TOKEN } from '../../src/platform/protocol';
import { SalesforceBrowser, type OpenOrgSetting } from './browser';
import { EditorServices } from './editor-services';
import { createRequestHandler, type HostUi } from './handlers';
import { HostHttp } from './http';
import { OrgService } from './orgs';
import { PanelManager } from './panel';
import { createSfExec, SfCli, type SfOrg } from './sf-cli';
import { HostStorage } from './storage';
import { StreamingService } from './streaming';

const TOOLS: Array<{ command: string; featureId: string; title: string }> = [
    { command: 'sftools.openQuery', featureId: 'query', title: 'Query' },
    { command: 'sftools.openApex', featureId: 'apex', title: 'Apex' },
    { command: 'sftools.openRestApi', featureId: 'rest-api', title: 'REST API' },
    { command: 'sftools.openEvents', featureId: 'events', title: 'Events' },
    { command: 'sftools.openDebugLogs', featureId: 'logs', title: 'Debug Logs' },
    { command: 'sftools.openSchema', featureId: 'schema', title: 'Schema' },
    { command: 'sftools.openDataImport', featureId: 'data-import', title: 'Data Import' },
    { command: 'sftools.openUtils', featureId: 'utils', title: 'Utils' },
    { command: 'sftools.openSettings', featureId: 'settings', title: 'Settings' },
];

function workspaceCwd(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function orgLabel(org: SfOrg): string {
    return org.alias ? `${org.alias} (${org.username})` : org.username;
}

export function activate(context: vscode.ExtensionContext): void {
    const cli = new SfCli(
        createSfExec(() => vscode.workspace.getConfiguration('sftools').get('sfPath', 'sf') || 'sf')
    );
    const orgs = new OrgService(cli, workspaceCwd);
    const storage = new HostStorage(context.globalState, orgs);
    const http = new HostHttp(orgs);
    const panels = new PanelManager(context.extensionUri);
    const editors = new EditorServices(context.extensionPath, context.globalStorageUri, () =>
        panels.broadcastEvent({ type: EDITOR_THEME_CHANGED })
    );
    const streaming = new StreamingService({
        resolveAuth: request => http.resolveStreamingAuth(request),
        deliver: (panelId, message) => panels.postEvent(panelId, message),
        protoPath: context.asAbsolutePath('dist/proto/pubsub_api.proto'),
    });

    const browser = new SalesforceBrowser<vscode.Uri>({
        getSetting: () =>
            vscode.workspace.getConfiguration('sftools').get<OpenOrgSetting>('openOrgIn'),
        getCommands: () => vscode.commands.getCommands(true),
        executeCommand: (command, url) => vscode.commands.executeCommand(command, url),
        openExternal: uri => vscode.env.openExternal(uri),
        parse: url => vscode.Uri.parse(url, true),
    });

    storage.onChanged(changes => panels.broadcastStorage(changes));
    panels.onDidClose(panelId => streaming.disposePanel(panelId));

    const openApp = (featureId?: string, title?: string): void => {
        panels.open({
            page: 'app',
            launchParams: featureId ? `feature=${encodeURIComponent(featureId)}` : '',
            title: title ? `sftools: ${title}` : 'sftools',
        });
    };

    const openRecord = (params: { objectType: string; recordId: string; connectionId: string }) => {
        const query = new URLSearchParams(params).toString();
        panels.open({
            page: 'record',
            launchParams: query,
            title: `${params.objectType} ${params.recordId}`,
        });
    };

    const refreshOrgs = async (): Promise<void> => {
        await orgs.refresh();
        await storage.emitConnectionsChanged();
        const error = orgs.getLastError();
        if (error) void vscode.window.showErrorMessage(`sftools: ${error}`);
    };

    const loginOrg = async (options: { instanceUrl?: string; alias?: string }): Promise<void> => {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Log in to Salesforce in your browser…',
            },
            () => cli.loginWeb({ ...options, cwd: workspaceCwd() })
        );
        await refreshOrgs();
        void vscode.window.showInformationMessage('sftools: Logged in. The org is ready to use.');
    };

    const ui: HostUi = {
        async openExternal(url) {
            const org = await orgs.findOrgForBrowserUrl(url);
            if (org) {
                try {
                    const parsed = new URL(url);
                    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
                    const signedIn = await cli.getOrgOpenUrl(org.username, path);
                    await browser.open(signedIn);
                    return;
                } catch {
                    // Fall back to the plain URL; the browser may ask to log in
                }
            }
            await vscode.env.openExternal(vscode.Uri.parse(url, true));
        },
        openFeature(featureId) {
            const tool = TOOLS.find(t => t.featureId === featureId);
            openApp(featureId, tool?.title);
        },
        openRecord,
        async saveFile(filename, content) {
            const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
            const target = await vscode.window.showSaveDialog({
                defaultUri: folder ? vscode.Uri.joinPath(folder, filename) : undefined,
                saveLabel: 'Save',
            });
            if (!target) return;
            await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
            void vscode.window.showInformationMessage(`Saved ${target.fsPath}`);
        },
        async loginOrg(options) {
            try {
                await loginOrg(options);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`sftools: Login failed. ${message}`);
                throw error;
            }
        },
        reload(panelId) {
            panels.reload(panelId);
        },
    };

    panels.setRequestHandler(createRequestHandler({ storage, http, orgs, streaming, ui, editors }));

    const pickOrg = async (placeHolder: string): Promise<SfOrg | undefined> => {
        const list = await orgs.getOrgs();
        if (list.length === 0) {
            const action = await vscode.window.showWarningMessage(
                orgs.getLastError() ?? 'No orgs found in the sf CLI.',
                'Log In to an Org'
            );
            if (action) await vscode.commands.executeCommand('sftools.loginOrg');
            return undefined;
        }
        if (list.length === 1) return list[0];
        const picked = await vscode.window.showQuickPick(
            list.map(org => ({
                label: orgLabel(org),
                description: org.isDefault ? 'Default org' : undefined,
                detail: org.instanceUrl,
                org,
            })),
            { placeHolder }
        );
        return picked?.org;
    };

    context.subscriptions.push(
        panels,
        vscode.window.registerWebviewViewProvider(
            'sftools.sidebar',
            {
                resolveWebviewView(view) {
                    panels.attachView(view, { page: 'app', launchParams: '' });
                },
            },
            { webviewOptions: { retainContextWhenHidden: true } }
        ),
        editors,
        { dispose: () => streaming.dispose() },
        vscode.commands.registerCommand('sftools.open', () => openApp()),
        ...TOOLS.map(tool =>
            vscode.commands.registerCommand(tool.command, () => openApp(tool.featureId, tool.title))
        ),
        vscode.commands.registerCommand('sftools.refreshOrgs', async () => {
            await refreshOrgs();
            const count = (await orgs.getOrgs()).length;
            if (!orgs.getLastError()) {
                void vscode.window.showInformationMessage(
                    `sftools: Found ${count} org(s) in the sf CLI.`
                );
            }
        }),
        vscode.commands.registerCommand('sftools.loginOrg', async () => {
            const kind = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Production / Developer Edition',
                        url: 'https://login.salesforce.com',
                    },
                    { label: 'Sandbox', url: 'https://test.salesforce.com' },
                    { label: 'My Domain URL…', url: '' },
                ],
                { placeHolder: 'Where do you log in?' }
            );
            if (!kind) return;
            let instanceUrl = kind.url;
            if (!instanceUrl) {
                const typed = await vscode.window.showInputBox({
                    prompt: 'My Domain login URL',
                    placeHolder: 'https://mydomain.my.salesforce.com',
                    validateInput: value =>
                        /^https:\/\/[^\s/]+/.test(value.trim())
                            ? undefined
                            : 'Enter an https:// URL',
                });
                if (!typed) return;
                instanceUrl = typed.trim();
            }
            const alias = await vscode.window.showInputBox({
                prompt: 'Alias for this org (optional)',
            });
            if (alias === undefined) return;
            try {
                await loginOrg({ instanceUrl, alias: alias.trim() || undefined });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`sftools: Login failed. ${message}`);
            }
        }),
        vscode.commands.registerCommand('sftools.openOrg', async () => {
            const org = await pickOrg('Open which org?');
            if (!org) return;
            try {
                const url = await cli.getOrgOpenUrl(org.username);
                await browser.open(url);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`sftools: ${message}`);
            }
        }),
        vscode.commands.registerCommand('sftools.openRecord', async () => {
            const recordId = (
                await vscode.window.showInputBox({
                    prompt: 'Record Id (15 or 18 characters)',
                    validateInput: value =>
                        /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(value.trim())
                            ? undefined
                            : 'Enter a 15 or 18 character Salesforce Id',
                })
            )?.trim();
            if (!recordId) return;
            const org = await pickOrg('Which org is the record in?');
            if (!org) return;
            const objectType = await findObjectByKeyPrefix(http, org, recordId.substring(0, 3));
            if (!objectType) {
                void vscode.window.showErrorMessage(
                    `sftools: No object in ${orgLabel(org)} uses the Id prefix ${recordId.substring(0, 3)}.`
                );
                return;
            }
            openRecord({ objectType, recordId, connectionId: org.username });
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => void refreshOrgs()),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sftools.sfPath')) void refreshOrgs();
        })
    );

    // The project's default org lives in .sf/config.json (or the older .sfdx)
    const configWatcher = vscode.workspace.createFileSystemWatcher(
        '**/{.sf/config.json,.sfdx/sfdx-config.json}'
    );
    const onConfig = () => void refreshOrgs();
    configWatcher.onDidChange(onConfig);
    configWatcher.onDidCreate(onConfig);
    configWatcher.onDidDelete(onConfig);
    context.subscriptions.push(configWatcher);
}

async function findObjectByKeyPrefix(
    http: HostHttp,
    org: SfOrg,
    keyPrefix: string
): Promise<string | undefined> {
    const response = await http.fetch({
        url: `${org.instanceUrl}/services/data/v${API_VERSION}/sobjects`,
        options: {
            headers: { Authorization: `Bearer ${SF_CLI_ACCESS_TOKEN}`, Accept: 'application/json' },
        },
        connectionId: org.username,
    });
    if (!response.success || !response.data) return undefined;
    const { sobjects } = JSON.parse(response.data) as {
        sobjects: Array<{ name: string; keyPrefix: string | null }>;
    };
    return sobjects.find(o => o.keyPrefix === keyPrefix)?.name;
}

export function deactivate(): void {
    // Disposables are registered on the context
}
