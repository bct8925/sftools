import { createElement } from 'lwc';
import AppContainer from 'c/appContainer';

// Mount the LWC component
const app = createElement('c-app-container', { is: AppContainer });
document.body.appendChild(app);
