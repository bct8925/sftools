import { useState, useCallback, useEffect, useRef } from 'react';

export type SubTab = 'apex' | 'bulk';

export interface JobsPreferences {
    activeSubTab: SubTab;
    apexJobs: {
        filterApexClass: string;
        filterStatus: string;
    };
    bulkJobs: {
        filterStatus: string;
        filterOperation: string;
        filterObject: string;
    };
}

const STORAGE_KEY = 'jobsPreferences';

const DEFAULTS: JobsPreferences = {
    activeSubTab: 'apex',
    apexJobs: {
        filterApexClass: '',
        filterStatus: '',
    },
    bulkJobs: {
        filterStatus: '',
        filterOperation: '',
        filterObject: '',
    },
};

function savePreferences(prefs: JobsPreferences): void {
    chrome.storage.local.set({ [STORAGE_KEY]: prefs });
}

/**
 * Hook for loading and persisting Jobs tab filter/sort preferences.
 * Loads from Chrome storage on mount, saves individual changes immediately.
 */
export function useJobsPreferences() {
    const [preferences, setPreferences] = useState<JobsPreferences>(DEFAULTS);
    const loadedRef = useRef(false);

    // Load from storage on mount
    useEffect(() => {
        chrome.storage.local.get([STORAGE_KEY]).then(result => {
            const stored = result[STORAGE_KEY] as Partial<JobsPreferences> | undefined;
            if (stored) {
                setPreferences(prev => ({
                    ...prev,
                    ...stored,
                    apexJobs: { ...prev.apexJobs, ...stored.apexJobs },
                    bulkJobs: { ...prev.bulkJobs, ...stored.bulkJobs },
                }));
            }
            loadedRef.current = true;
        });
    }, []);

    // Save whenever preferences change (after initial load)
    useEffect(() => {
        if (loadedRef.current) {
            savePreferences(preferences);
        }
    }, [preferences]);

    const setActiveSubTab = useCallback((tab: SubTab) => {
        setPreferences(prev => ({ ...prev, activeSubTab: tab }));
    }, []);

    const setApexFilter = useCallback((key: keyof JobsPreferences['apexJobs'], value: string) => {
        setPreferences(prev => ({
            ...prev,
            apexJobs: { ...prev.apexJobs, [key]: value },
        }));
    }, []);

    const setBulkFilter = useCallback((key: keyof JobsPreferences['bulkJobs'], value: string) => {
        setPreferences(prev => ({
            ...prev,
            bulkJobs: { ...prev.bulkJobs, [key]: value },
        }));
    }, []);

    return {
        preferences,
        setActiveSubTab,
        setApexFilter,
        setBulkFilter,
    };
}
