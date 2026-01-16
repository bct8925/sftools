# Phase 1: Foundation - Research

**Researched:** 2026-01-15
**Domain:** SLDS (Salesforce Lightning Design System) icons for Vite + Web Components
**Confidence:** HIGH

<research_summary>
## Summary

Researched how to use Salesforce Lightning Design System icons in a Chrome Extension using Vite and vanilla Web Components (no React/Vue, no Shadow DOM). The primary options are SVG sprites (standard SLDS approach) or individual SVG imports for tree-shaking.

The `@salesforce-ux/icons` package provides individual SVGs organized by category (utility, action, custom, standard, doctype). For optimal bundle size with tree-shaking, individual SVG imports via Vite's `?raw` suffix is recommended over sprite sheets which bundle all ~400KB+ of icons.

**Primary recommendation:** Use `@salesforce-ux/icons` package with individual SVG imports. Create a simple icon utility function that renders inline SVGs. Import only the specific icons needed to minimize bundle size.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @salesforce-ux/icons | 10.14.x | Individual SVG icon files | Official Salesforce icons, organized by category |
| @salesforce-ux/design-system | 2.x | CSS classes for icon styling | Official SLDS styling (slds-icon classes) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-svgr | latest | Transform SVGs to components | If React-style component approach desired |
| vite-plugin-magical-svg | latest | Auto sprite generation with tree-shaking | Alternative if sprite approach preferred |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Individual SVG imports | SVG sprite sheets | Sprites include ALL icons (~400KB), no tree-shaking |
| @salesforce-ux/icons | @salesforce-ux/design-system | design-system is larger, includes CSS/tokens we may not need |
| Inline SVG utility | slds-icon-font npm package | Font approach less flexible for styling |

**Installation:**
```bash
npm install @salesforce-ux/icons
```

Note: The full `@salesforce-ux/design-system` package may not be needed if sftools already has Lightning-inspired CSS. Only install if SLDS icon CSS classes are required.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── icons.js          # Icon utility with individual icon imports
├── components/
│   └── (existing tabs)   # Use icons via utility
```

### Pattern 1: Inline SVG Utility Function
**What:** Create a utility that exports individual icon SVGs as strings or DOM elements
**When to use:** Best for tree-shaking, Web Components, no build plugin needed
**Example:**
```javascript
// src/lib/icons.js
// Import individual SVGs as raw strings
import playIcon from '@salesforce-ux/icons/dist/svg/utility/play.svg?raw';
import refreshIcon from '@salesforce-ux/icons/dist/svg/utility/refresh.svg?raw';
import closeIcon from '@salesforce-ux/icons/dist/svg/utility/close.svg?raw';

// Export icon map for easy access
export const icons = {
    play: playIcon,
    refresh: refreshIcon,
    close: closeIcon,
    // ... add more as needed
};

// Utility function to render icon
export function renderIcon(name, options = {}) {
    const { size = '16', className = '' } = options;
    const svg = icons[name];
    if (!svg) return '';

    // Parse SVG and apply sizing/classes
    const wrapper = document.createElement('span');
    wrapper.innerHTML = svg;
    const svgEl = wrapper.querySelector('svg');
    svgEl.setAttribute('width', size);
    svgEl.setAttribute('height', size);
    if (className) svgEl.classList.add(...className.split(' '));
    svgEl.setAttribute('aria-hidden', 'true');

    return wrapper.innerHTML;
}
```

### Pattern 2: SVG Sprite with Inline Embedding
**What:** Embed sprite sheet in HTML, reference via `<use href="#icon-id">`
**When to use:** If bundle size is less critical, simpler HTML structure
**Example:**
```html
<!-- Embed sprite once in page -->
<svg style="display:none" id="slds-icons">
  <symbol id="icon-play" viewBox="0 0 52 52">...</symbol>
  <symbol id="icon-refresh" viewBox="0 0 52 52">...</symbol>
</svg>

<!-- Use anywhere -->
<svg class="slds-icon" aria-hidden="true">
  <use href="#icon-play"></use>
</svg>
```

### Pattern 3: Direct SVG Element Creation
**What:** Programmatically create SVG elements in JavaScript
**When to use:** For dynamic icon rendering in Web Components
**Example:**
```javascript
// In component
const iconHtml = renderIcon('play', { size: '20', className: 'icon-action' });
this.querySelector('.icon-container').innerHTML = iconHtml;
```

### Anti-Patterns to Avoid
- **Importing entire sprite sheets:** Bundles all ~400KB of icons even if using 10
- **Using xlink:href:** Deprecated in SVG 2, use plain `href` instead
- **External sprite references:** May have CORS issues, especially in extensions
- **Creating SVG per render:** Cache SVG strings, don't re-parse repeatedly
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon library | Copying SVG files manually | @salesforce-ux/icons package | Package stays updated, organized by category |
| Icon sizing | Custom width/height logic | SLDS CSS classes (slds-icon_xx-small, etc.) | Consistent with Lightning Design System |
| Icon coloring | Inline fill attributes | CSS `fill: currentColor` | Inherits text color, easier theming |
| Accessibility | Manual aria attributes | Standard pattern with aria-hidden="true" | SLDS recommends hiding decorative icons |
| Sprite generation | Manual sprite creation | Use package's provided sprites or individual imports | Already optimized and organized |

**Key insight:** The @salesforce-ux/icons package already organizes icons by category (utility, action, standard, custom, doctype) with consistent naming. Don't reorganize or rename - use the official structure.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Bundle Size Bloat from Sprites
**What goes wrong:** Including sprite sheet pulls in ~400KB+ of icons
**Why it happens:** Default SLDS examples use sprite approach
**How to avoid:** Import individual SVGs via `?raw` suffix in Vite
**Warning signs:** Large initial bundle, slow extension load

### Pitfall 2: Icons Not Displaying (External Reference)
**What goes wrong:** `<use href="path/to/sprite.svg#icon">` shows nothing
**Why it happens:** External SVG references blocked by CORS/CSP in extensions
**How to avoid:** Inline SVG content directly or embed sprite in HTML
**Warning signs:** Empty icon containers, no console errors

### Pitfall 3: Inconsistent Icon Sizes
**What goes wrong:** Icons appear different sizes across the app
**Why it happens:** Missing viewBox preservation or inconsistent size attributes
**How to avoid:** Always preserve viewBox, use consistent size utility
**Warning signs:** Icons too large/small in some contexts

### Pitfall 4: Color Not Applying
**What goes wrong:** Icons stay black when parent text color changes
**Why it happens:** SVG has hardcoded fill attributes
**How to avoid:** Ensure SVGs use `fill="currentColor"` or CSS-controlled fills
**Warning signs:** Icons don't match surrounding text color

### Pitfall 5: xlink:href Deprecation Warnings
**What goes wrong:** Console warnings about deprecated xlink namespace
**Why it happens:** Using old `xlink:href` instead of plain `href`
**How to avoid:** Use `href` without xlink namespace (SVG 2 standard)
**Warning signs:** Browser console deprecation warnings
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Individual SVG Import with Vite
```javascript
// src/lib/icons.js
// Source: Vite documentation + @salesforce-ux/icons structure

// Import as raw strings - Vite handles this natively
import play from '@salesforce-ux/icons/dist/svg/utility/play.svg?raw';
import refresh from '@salesforce-ux/icons/dist/svg/utility/refresh.svg?raw';
import close from '@salesforce-ux/icons/dist/svg/utility/close.svg?raw';
import search from '@salesforce-ux/icons/dist/svg/utility/search.svg?raw';
import settings from '@salesforce-ux/icons/dist/svg/utility/settings.svg?raw';
import add from '@salesforce-ux/icons/dist/svg/utility/add.svg?raw';
import delete_ from '@salesforce-ux/icons/dist/svg/utility/delete.svg?raw';
import edit from '@salesforce-ux/icons/dist/svg/utility/edit.svg?raw';
import save from '@salesforce-ux/icons/dist/svg/utility/save.svg?raw';

export const icons = {
    play, refresh, close, search, settings, add, delete: delete_, edit, save
};

export function icon(name, { size = 16, className = '' } = {}) {
    const svg = icons[name];
    if (!svg) {
        console.warn(`Icon "${name}" not found`);
        return '';
    }
    // Apply size and class to SVG string
    return svg
        .replace(/<svg/, `<svg width="${size}" height="${size}" class="${className}" aria-hidden="true"`)
        .replace(/fill="[^"]*"/g, 'fill="currentColor"');
}
```

### Usage in Web Component
```javascript
// Source: sftools component pattern
import { icon } from '../../lib/icons.js';

class MyTab extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <button class="btn-execute">
                ${icon('play', { size: 16 })} Execute
            </button>
            <button class="btn-refresh">
                ${icon('refresh', { size: 16 })} Refresh
            </button>
        `;
    }
}
```

### SLDS Icon CSS Classes (if using design-system CSS)
```html
<!-- Source: Lightning Design System documentation -->
<span class="slds-icon_container slds-icon-utility-settings">
    <svg class="slds-icon slds-icon-text-default slds-icon_x-small" aria-hidden="true">
        <!-- inline SVG content -->
    </svg>
</span>
```

### Icon Button Pattern
```html
<!-- Source: sftools existing patterns + SLDS -->
<button class="icon-button" title="Refresh">
    <svg class="icon" width="16" height="16" aria-hidden="true">
        <!-- SVG content -->
    </svg>
</button>
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xlink:href | Plain href | SVG 2 (2018+) | Remove xlink namespace, simpler syntax |
| Sprite sheets | Individual imports | Modern bundlers | Tree-shaking support, smaller bundles |
| Icon fonts | Inline SVGs | 2020+ | Better accessibility, scalability, coloring |

**New tools/patterns to consider:**
- **Vite ?raw import:** Native support for raw file imports, no plugin needed
- **CSS currentColor:** Inherit color from parent, no fill manipulation needed

**Deprecated/outdated:**
- **xlink namespace:** SVG 2 removed requirement, use plain href
- **Icon fonts for UI:** SVGs preferred for accessibility and flexibility
- **External sprite references:** Problematic with CORS/CSP, inline preferred
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Exact icon path in @salesforce-ux/icons**
   - What we know: Icons organized by type in dist/svg/{type}/ folders
   - What's unclear: Exact subfolder structure (common vs ltr vs rtl)
   - Recommendation: Verify path structure after npm install, may need adjustment

2. **SLDS CSS class requirements**
   - What we know: SLDS provides slds-icon-* classes for sizing/display
   - What's unclear: Whether sftools needs these or can use existing styles
   - Recommendation: Start without SLDS CSS, add if needed for consistency
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [@salesforce-ux/design-system - npm](https://www.npmjs.com/package/@salesforce-ux/design-system) - Package structure, icon sprites
- [@salesforce-ux/icons - npm](https://www.npmjs.com/package/@salesforce-ux/icons) - Individual icon files
- [Lightning Design System Icons](https://www.lightningdesignsystem.com/icons/) - Icon categories, official guidance
- [Vite Static Asset Handling](https://vitejs.dev/guide/assets.html) - ?raw import syntax

### Secondary (MEDIUM confidence)
- [MDN xlink:href](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xlink:href) - Deprecation, href migration
- [GitHub salesforce/design-system-react](https://github.com/salesforce/design-system-react) - React patterns (adapted for vanilla JS)

### Tertiary (LOW confidence - needs validation)
- Icon path structure needs verification after package install
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: @salesforce-ux/icons, @salesforce-ux/design-system
- Ecosystem: Vite SVG handling, Web Components integration
- Patterns: Inline SVG utility, tree-shakeable imports
- Pitfalls: Bundle size, CORS, sizing, coloring

**Confidence breakdown:**
- Standard stack: HIGH - official Salesforce packages
- Architecture: HIGH - patterns verified from docs and community
- Pitfalls: HIGH - well-documented issues
- Code examples: MEDIUM - need path verification after install

**Research date:** 2026-01-15
**Valid until:** 2026-02-15 (30 days - stable ecosystem)
</metadata>

---

*Phase: 01-foundation*
*Research completed: 2026-01-15*
*Ready for planning: yes*
