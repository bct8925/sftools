// Chrome extension optional permission utilities

export async function requestPermission(permission: string): Promise<boolean> {
    try {
        const granted = await chrome.permissions.request({
            permissions: [permission as chrome.runtime.ManifestPermissions],
        });
        console.log(`[sftools] Permission "${permission}" request result:`, granted);
        return granted;
    } catch (error) {
        console.error(`[sftools] Permission "${permission}" request failed:`, error);
        return false;
    }
}

export async function hasPermission(permission: string): Promise<boolean> {
    try {
        return await chrome.permissions.contains({
            permissions: [permission as chrome.runtime.ManifestPermissions],
        });
    } catch {
        return false;
    }
}
