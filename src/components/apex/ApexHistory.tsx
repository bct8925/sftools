// Apex History - thin wrapper around ScriptHistory
import { forwardRef } from 'react';
import { ScriptHistory, type ScriptHistoryRef } from '../script-list/ScriptHistory';
import { getPreview } from '../../lib/apex-utils';
import styles from './ApexTab.module.css';

export type ApexHistoryRef = ScriptHistoryRef;

interface ApexHistoryProps {
    onLoadScript: (code: string) => void;
}

export const ApexHistory = forwardRef<ApexHistoryRef, ApexHistoryProps>(({ onLoadScript }, ref) => (
    <ScriptHistory
        ref={ref}
        storageKeys={{ history: 'apexHistory', favorites: 'apexFavorites' }}
        contentProperty="code"
        getContent={item => item.code as string}
        getPreview={getPreview}
        emptyHistoryMessage={
            <>
                No scripts yet.
                <br />
                Execute some Apex to see history here.
            </>
        }
        emptyFavoritesMessage={
            <>
                No favorites yet.
                <br />
                Click &#9733; on a script to save it.
            </>
        }
        favoritePlaceholder="Enter a label for this script"
        testIdPrefix="apex"
        buttonClassName={styles.historyBtn}
        onLoad={onLoadScript}
    />
));

ApexHistory.displayName = 'ApexHistory';
