import type { SalesforceConnection } from './salesforce';

// Connection Changed Event
export interface ConnectionChangedEvent extends CustomEvent<SalesforceConnection | null> {
  type: 'connection-changed';
}

// Theme Changed Event
export interface ThemeChangedEvent extends CustomEvent<'light' | 'dark'> {
  type: 'theme-changed';
}

// Extend document and window event maps for custom events
declare global {
  interface DocumentEventMap {
    'connection-changed': ConnectionChangedEvent;
    'theme-changed': ThemeChangedEvent;
  }

  interface WindowEventMap {
    'connection-changed': ConnectionChangedEvent;
    'theme-changed': ThemeChangedEvent;
  }
}

export {};
