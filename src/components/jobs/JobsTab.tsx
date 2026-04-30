import { useState, useCallback } from 'react';
import { useJobsPreferences, type SubTab } from './useJobsPreferences';
import { ApexJobsPanel } from './ApexJobsPanel';
import { BulkJobsPanel } from './BulkJobsPanel';
import styles from './JobsTab.module.css';

const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'apex', label: 'Apex Jobs' },
    { id: 'bulk', label: 'Bulk Jobs' },
];

/**
 * Jobs Tab - Monitor Salesforce background jobs.
 * Two sub-tabs: Apex Jobs (SOQL on AsyncApexJob) and Bulk Jobs (REST Bulk API v2).
 * Both panels mount lazily on first visit and stay mounted to preserve state.
 */
export function JobsTab() {
    const { preferences, setActiveSubTab, setApexFilter, setBulkFilter } = useJobsPreferences();
    const [visitedSubTabs, setVisitedSubTabs] = useState<Set<SubTab>>(
        () => new Set([preferences.activeSubTab])
    );

    const activeSubTab = preferences.activeSubTab;

    const handleSubTabClick = useCallback(
        (tab: SubTab) => {
            setVisitedSubTabs(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)));
            setActiveSubTab(tab);
        },
        [setActiveSubTab]
    );

    return (
        <div className={styles.jobsTab} data-testid="jobs-tab">
            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIcon}`}>J</div>
                    <h2>Jobs</h2>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {/* Sub-tab bar */}
                    <div className={styles.subTabBar}>
                        {SUB_TABS.map(tab => (
                            <button
                                key={tab.id}
                                className={`${styles.subTab} ${activeSubTab === tab.id ? styles.subTabActive : ''}`}
                                onClick={() => handleSubTabClick(tab.id)}
                                data-testid={`jobs-subtab-${tab.id}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Panel content — mount once, hide with display:none */}
                    {visitedSubTabs.has('apex') && (
                        <div style={{ display: activeSubTab === 'apex' ? 'contents' : 'none' }}>
                            <ApexJobsPanel
                                preferences={preferences}
                                onFilterChange={setApexFilter}
                            />
                        </div>
                    )}
                    {visitedSubTabs.has('bulk') && (
                        <div style={{ display: activeSubTab === 'bulk' ? 'contents' : 'none' }}>
                            <BulkJobsPanel
                                preferences={preferences}
                                onFilterChange={setBulkFilter}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
