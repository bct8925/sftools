// History & Favorites Manager for component tabs
// Handles storage and data management for history/favorites lists

export class HistoryManager {
    constructor(storageKeys, options = {}) {
        this.historyKey = storageKeys.history;
        this.favoritesKey = storageKeys.favorites;
        this.maxSize = options.maxSize || 30;
        this.contentProperty = options.contentProperty || 'content';

        this.history = [];
        this.favorites = [];
    }

    /**
     * Load history and favorites from storage
     */
    async load() {
        const data = await chrome.storage.local.get([this.historyKey, this.favoritesKey]);
        this.history = data[this.historyKey] || [];
        this.favorites = data[this.favoritesKey] || [];
    }

    /**
     * Save item to history
     * If item is already in favorites, just update timestamp
     * If item exists in history, move it to the top
     */
    async saveToHistory(content) {
        const trimmed = content.trim();
        if (!trimmed) return;

        const contentProp = this.contentProperty;

        // If already in favorites, just update the timestamp
        const favoriteIndex = this.favorites.findIndex(
            item => item[contentProp].trim() === trimmed
        );
        if (favoriteIndex !== -1) {
            this.favorites[favoriteIndex].timestamp = Date.now();
            await this.saveFavorites();
            return;
        }

        // Remove duplicate if exists
        const existingIndex = this.history.findIndex(item => item[contentProp].trim() === trimmed);
        if (existingIndex !== -1) {
            this.history.splice(existingIndex, 1);
        }

        // Add to beginning
        this.history.unshift({
            id: Date.now().toString(),
            [contentProp]: trimmed,
            timestamp: Date.now(),
        });

        // Trim to max size
        if (this.history.length > this.maxSize) {
            this.history = this.history.slice(0, this.maxSize);
        }

        await this.saveHistory();
    }

    /**
     * Add item to favorites with a label
     */
    async addToFavorites(content, label) {
        const trimmedContent = content.trim();
        const trimmedLabel = label.trim();

        if (!trimmedContent || !trimmedLabel) return;

        const contentProp = this.contentProperty;

        this.favorites.unshift({
            id: Date.now().toString(),
            [contentProp]: trimmedContent,
            label: trimmedLabel,
            timestamp: Date.now(),
        });

        await this.saveFavorites();
    }

    /**
     * Remove item from history by ID
     */
    async removeFromHistory(id) {
        this.history = this.history.filter(item => item.id !== id);
        await this.saveHistory();
    }

    /**
     * Remove item from favorites by ID
     */
    async removeFromFavorites(id) {
        this.favorites = this.favorites.filter(item => item.id !== id);
        await this.saveFavorites();
    }

    /**
     * Get a preview of content (truncated)
     */
    getPreview(content, maxLength = 60) {
        const cleaned = content.replace(/\s+/g, ' ').trim();
        return cleaned.length > maxLength ? `${cleaned.substring(0, maxLength)}...` : cleaned;
    }

    /**
     * Format timestamp as relative time
     */
    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    // Private storage methods
    async saveHistory() {
        await chrome.storage.local.set({ [this.historyKey]: this.history });
    }

    async saveFavorites() {
        await chrome.storage.local.set({ [this.favoritesKey]: this.favorites });
    }
}
