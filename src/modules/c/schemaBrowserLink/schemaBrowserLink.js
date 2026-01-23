// Schema Browser Link - LWC version of the schema browser launcher
import { LightningElement } from 'lwc';
import { getActiveConnectionId } from '../../../lib/utils.js';

export default class SchemaBrowserLink extends LightningElement {
    openSchemaBrowser() {
        const connectionId = getActiveConnectionId();

        if (!connectionId) {
            alert('Please select a connection first');
            return;
        }

        const url = `/dist/pages/schema/index.html?connectionId=${encodeURIComponent(connectionId)}`;
        window.open(url, '_blank');
    }
}
