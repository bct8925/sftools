// SVG icon library for sftools using SLDS icons
// All icons use currentColor to inherit text color

// Import SLDS utility icons as raw SVG strings
import closeIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/close.svg?raw';
import refreshIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/refresh.svg?raw';
import rowsIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/rows.svg?raw';
import threedotsVerticalIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/threedots_vertical.svg?raw';
import editIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/edit.svg?raw';
import deleteIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/delete.svg?raw';
import clockIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/clock.svg?raw';
import settingsIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/settings.svg?raw';
import playIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/play.svg?raw';
import stopIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/stop.svg?raw';
import databaseIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/database.svg?raw';
import apexIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/apex.svg?raw';
import listIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/list.svg?raw';
import httpIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/http.svg?raw';
import eventIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/event.svg?raw';
import backIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/back.svg?raw';

interface ProcessSvgOptions {
    size?: number;
}

/**
 * Process raw SVG for consistent rendering
 * - Sets width/height for sizing
 * - Replaces fill color with currentColor for theming
 */
function processSvg(svg: string, { size = 16 }: ProcessSvgOptions = {}): string {
    return svg
        .replace(/width="[^"]*"/, `width="${size}"`)
        .replace(/height="[^"]*"/, `height="${size}"`)
        .replace(/fill="#FFFFFF"/g, 'fill="currentColor"')
        .replace(/fill="#ffffff"/g, 'fill="currentColor"');
}

export const icons = {
    // Navigation and UI
    hamburger: processSvg(rowsIcon, { size: 20 }),
    close: processSvg(closeIcon, { size: 16 }),
    closeLarge: processSvg(closeIcon, { size: 20 }),
    verticalDots: processSvg(threedotsVerticalIcon, { size: 16 }),

    // Actions
    edit: processSvg(editIcon, { size: 16 }),
    refresh: processSvg(refreshIcon, { size: 16 }),
    refreshSmall: processSvg(refreshIcon, { size: 12 }),
    trash: processSvg(deleteIcon, { size: 16 }),

    // Smaller icons for tabs and inline use
    refreshTab: processSvg(refreshIcon, { size: 14 }),
    closeTab: processSvg(closeIcon, { size: 14 }),

    // Button-icon replacements (for HTML entity migration)
    clock: processSvg(clockIcon, { size: 16 }),
    settings: processSvg(settingsIcon, { size: 16 }),
    play: processSvg(playIcon, { size: 16 }),
    stop: processSvg(stopIcon, { size: 16 }),

    // External link icon (custom SVG)
    externalLink:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',

    // Tile icons (size 32 for home screen tiles)
    tileQuery: processSvg(databaseIcon, { size: 32 }),
    tileApex: processSvg(apexIcon, { size: 32 }),
    tileLogs: processSvg(listIcon, { size: 32 }),
    tileRestApi: processSvg(httpIcon, { size: 32 }),
    tileEvents: processSvg(eventIcon, { size: 32 }),
    tileUtils:
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tileSettings: processSvg(settingsIcon, { size: 32 }),

    // Back navigation (size 20)
    back: processSvg(backIcon, { size: 20 }),
} as const;

export type IconName = keyof typeof icons;
