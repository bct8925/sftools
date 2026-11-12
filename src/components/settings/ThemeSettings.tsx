import { useTheme } from '../../contexts/ThemeContext';
import { isVsCode } from '../../platform';
import styles from './ThemeSettings.module.css';

export function ThemeSettings() {
    const { theme, setTheme } = useTheme();
    // In VS Code, System takes on the VS Code theme; Light and Dark are sftools' own
    const vscode = isVsCode();

    return (
        <div className={styles.themeSection}>
            <label className={styles.themeLabel}>Theme</label>
            <div className={styles.themeOptions}>
                <label className={styles.themeOption}>
                    <input
                        type="radio"
                        name="theme"
                        value="system"
                        checked={theme === 'system'}
                        onChange={e => setTheme(e.target.value as 'system')}
                        className={styles.themeRadio}
                        data-testid="settings-theme-radio-system"
                    />
                    <span className={styles.themeOptionLabel}>System</span>
                    <span className={styles.themeOptionDesc}>
                        {vscode ? 'Match the VS Code theme' : 'Follow system preference'}
                    </span>
                </label>
                <label className={styles.themeOption}>
                    <input
                        type="radio"
                        name="theme"
                        value="light"
                        checked={theme === 'light'}
                        onChange={e => setTheme(e.target.value as 'light')}
                        className={styles.themeRadio}
                        data-testid="settings-theme-radio-light"
                    />
                    <span className={styles.themeOptionLabel}>Light</span>
                    <span className={styles.themeOptionDesc}>
                        {vscode ? 'sftools light colors' : 'Always use light mode'}
                    </span>
                </label>
                <label className={styles.themeOption}>
                    <input
                        type="radio"
                        name="theme"
                        value="dark"
                        checked={theme === 'dark'}
                        onChange={e => setTheme(e.target.value as 'dark')}
                        className={styles.themeRadio}
                        data-testid="settings-theme-radio-dark"
                    />
                    <span className={styles.themeOptionLabel}>Dark</span>
                    <span className={styles.themeOptionDesc}>
                        {vscode ? 'sftools dark colors' : 'Always use dark mode'}
                    </span>
                </label>
            </div>
        </div>
    );
}
