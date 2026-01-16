// SVG icon library for sftools using SLDS icons
// All icons use currentColor to inherit text color

// Import SLDS utility icons as raw SVG strings
import closeIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/close.svg?raw';
import refreshIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/refresh.svg?raw';
import rowsIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/rows.svg?raw';
import threedotsVerticalIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/threedots_vertical.svg?raw';
import editIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/edit.svg?raw';
import deleteIcon from '@salesforce-ux/icons/dist/salesforce-lightning-design-system-icons/utility/delete.svg?raw';

/**
 * Process raw SVG for consistent rendering
 * - Sets width/height for sizing
 * - Replaces fill color with currentColor for theming
 */
function processSvg(svg, { size = 16 } = {}) {
    return svg
        .replace(/width="[^"]*"/, `width="${size}"`)
        .replace(/height="[^"]*"/, `height="${size}"`)
        .replace(/fill="#FFFFFF"/g, 'fill="currentColor"')
        .replace(/fill="#ffffff"/g, 'fill="currentColor"');
}

/**
 * Replaces icon placeholders in HTML string with actual SVG icons
 * Usage: {{icon:close}}, {{icon:edit}}, etc.
 */
export function replaceIcons(html) {
    return html.replace(/\{\{icon:(\w+)\}\}/g, (match, iconName) => {
        return icons[iconName] || match;
    });
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
    closeTab: processSvg(closeIcon, { size: 14 })
};
