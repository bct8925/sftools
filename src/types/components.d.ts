import type { editor } from 'monaco-editor';
import type { SalesforceConnection } from './salesforce';

// Monaco Editor Component
export interface MonacoEditorElement extends HTMLElement {
  editor: editor.IStandaloneCodeEditor | null;
  getValue(): string;
  setValue(value: string): void;
  appendValue(text: string): void;
  clear(): void;
  setMarkers(markers: editor.IMarkerData[]): void;
  clearMarkers(): void;
  focus(): void;
}

// Connection Changed Event
export interface ConnectionChangedEvent extends CustomEvent<SalesforceConnection | null> {
  type: 'connection-changed';
}

// Theme Changed Event
export interface ThemeChangedEvent extends CustomEvent<'light' | 'dark'> {
  type: 'theme-changed';
}

// Declare custom elements for type-safe querySelector
declare global {
  interface HTMLElementTagNameMap {
    'monaco-editor': MonacoEditorElement;
    'query-tab': HTMLElement;
    'apex-tab': HTMLElement;
    'rest-api-tab': HTMLElement;
    'events-tab': HTMLElement;
    'utils-tab': HTMLElement;
    'settings-tab': HTMLElement;
    'record-page': HTMLElement;
    'schema-page': HTMLElement;
    'button-dropdown': HTMLElement;
    'button-icon': HTMLElement;
    'modal-popup': HTMLElement;
    'sf-icon': HTMLElement;
  }

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
