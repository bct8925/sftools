import { useConnection } from '../../contexts/ConnectionContext';
import { SchemaPage } from './SchemaPage';

/**
 * Schema tab wrapper - reads connection from context and passes to SchemaPage.
 */
export function SchemaTab() {
    const { activeConnection, isAuthenticated } = useConnection();

    if (!isAuthenticated || !activeConnection) return null;

    return (
        <SchemaPage connectionId={activeConnection.id} instanceUrl={activeConnection.instanceUrl} />
    );
}
