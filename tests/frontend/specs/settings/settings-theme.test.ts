import { SftoolsTest } from '../../framework/base-test';

/**
 * Test theme switching in Settings tab
 *
 * Test IDs: S-F-001, S-F-002, S-F-003
 * - S-F-001: Select System theme - Theme follows OS
 * - S-F-002: Select Light theme - Light mode applied
 * - S-F-003: Select Dark theme - Dark mode applied
 */
export default class SettingsThemeTest extends SftoolsTest {
  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Settings tab
    await this.settingsTab.navigateTo();

    // Set theme to dark
    await this.settingsTab.setTheme('dark');

    // Verify document has data-theme="dark" attribute
    const darkThemeSet = await this.page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    });
    await this.expect(darkThemeSet).toBe(true);

    // Set theme to light
    await this.settingsTab.setTheme('light');

    // Verify data-theme attribute is not present or is 'light'
    const lightThemeSet = await this.page.evaluate(() => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      return themeAttr === null || themeAttr === 'light';
    });
    await this.expect(lightThemeSet).toBe(true);

    // Set theme back to system (default)
    await this.settingsTab.setTheme('system');

    // Verify system theme is selected
    const selectedTheme = await this.settingsTab.getSelectedTheme();
    await this.expect(selectedTheme).toBe('system');
  }
}
