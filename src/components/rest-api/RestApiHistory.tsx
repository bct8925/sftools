// REST API History - thin wrapper around ScriptHistory
import { forwardRef } from 'react';
import { ScriptHistory, type ScriptHistoryRef } from '../script-list/ScriptHistory';
import styles from './RestApiTab.module.css';

export type RestApiHistoryRef = ScriptHistoryRef;

export interface RestApiRequest {
    method: string;
    url: string;
    body?: string;
}

interface RestApiHistoryProps {
    onLoadRequest: (request: RestApiRequest) => void;
}

function parseRequest(content: string): RestApiRequest | null {
    try {
        return JSON.parse(content) as RestApiRequest;
    } catch {
        return null;
    }
}

function getPreview(content: string): string {
    const req = parseRequest(content);
    if (!req) return content;
    const truncatedUrl = req.url.length > 40 ? `${req.url.slice(0, 40)}...` : req.url;
    return `${req.method} ${truncatedUrl}`;
}

export const RestApiHistory = forwardRef<RestApiHistoryRef, RestApiHistoryProps>(
    ({ onLoadRequest }, ref) => (
        <ScriptHistory
            ref={ref}
            storageKeys={{ history: 'restApiHistory', favorites: 'restApiFavorites' }}
            contentProperty="request"
            getContent={item => item.request as string}
            getPreview={getPreview}
            emptyHistoryMessage={
                <>
                    No requests yet.
                    <br />
                    Send some API requests to see history here.
                </>
            }
            emptyFavoritesMessage={
                <>
                    No favorites yet.
                    <br />
                    Click &#9733; on a request to save it.
                </>
            }
            favoritePlaceholder="Enter a label for this request"
            testIdPrefix="rest-api"
            buttonClassName={styles.historyBtn}
            renderMeta={item => {
                const req = parseRequest(item.request as string);
                return req ? <span className={styles.methodBadge}>{req.method}</span> : null;
            }}
            onLoad={content => {
                const req = parseRequest(content);
                if (req) onLoadRequest(req);
            }}
        />
    )
);

RestApiHistory.displayName = 'RestApiHistory';
