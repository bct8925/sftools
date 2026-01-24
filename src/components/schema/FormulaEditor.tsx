import { useState, useRef, useCallback, useEffect } from 'react';
import type { FieldDescribe } from '../../types/salesforce';
import { Modal } from '../modal/Modal';
import { MonacoEditor, type MonacoEditorRef, monaco } from '../monaco-editor/MonacoEditor';
import { SfIcon } from '../sf-icon/SfIcon';
import {
  getFormulaFieldMetadata,
  updateFormulaField,
  getObjectDescribe,
} from '../../lib/salesforce.js';
import type { languages } from 'monaco-editor';
import styles from './SchemaPage.module.css';

// Formula functions for autocomplete
const FORMULA_FUNCTIONS = [
  { name: 'IF', signature: 'IF(logical_test, value_if_true, value_if_false)', description: 'Returns one value if a condition is true and another if false' },
  { name: 'CASE', signature: 'CASE(expression, value1, result1, ..., else_result)', description: 'Compares expression to values and returns corresponding result' },
  { name: 'AND', signature: 'AND(logical1, logical2, ...)', description: 'Returns TRUE if all arguments are true' },
  { name: 'OR', signature: 'OR(logical1, logical2, ...)', description: 'Returns TRUE if any argument is true' },
  { name: 'NOT', signature: 'NOT(logical)', description: 'Returns TRUE if the argument is false' },
  { name: 'ISBLANK', signature: 'ISBLANK(expression)', description: 'Returns TRUE if the expression is blank' },
  { name: 'BLANKVALUE', signature: 'BLANKVALUE(expression, substitute)', description: 'Returns substitute if expression is blank' },
  { name: 'TEXT', signature: 'TEXT(value)', description: 'Converts a value to text' },
  { name: 'VALUE', signature: 'VALUE(text)', description: 'Converts text to a number' },
  { name: 'LEN', signature: 'LEN(text)', description: 'Returns the number of characters' },
  { name: 'LEFT', signature: 'LEFT(text, num_chars)', description: 'Returns leftmost characters' },
  { name: 'RIGHT', signature: 'RIGHT(text, num_chars)', description: 'Returns rightmost characters' },
  { name: 'MID', signature: 'MID(text, start, num_chars)', description: 'Returns middle characters' },
  { name: 'LOWER', signature: 'LOWER(text)', description: 'Converts to lowercase' },
  { name: 'UPPER', signature: 'UPPER(text)', description: 'Converts to uppercase' },
  { name: 'TRIM', signature: 'TRIM(text)', description: 'Removes leading/trailing spaces' },
  { name: 'CONTAINS', signature: 'CONTAINS(text, compare)', description: 'Checks if text contains compare' },
  { name: 'TODAY', signature: 'TODAY()', description: 'Returns current date' },
  { name: 'NOW', signature: 'NOW()', description: 'Returns current date and time' },
  { name: 'DATE', signature: 'DATE(year, month, day)', description: 'Creates a date' },
  { name: 'YEAR', signature: 'YEAR(date)', description: 'Returns the year' },
  { name: 'MONTH', signature: 'MONTH(date)', description: 'Returns the month (1-12)' },
  { name: 'DAY', signature: 'DAY(date)', description: 'Returns the day (1-31)' },
  { name: 'ABS', signature: 'ABS(number)', description: 'Returns absolute value' },
  { name: 'CEILING', signature: 'CEILING(number)', description: 'Rounds up to integer' },
  { name: 'FLOOR', signature: 'FLOOR(number)', description: 'Rounds down to integer' },
  { name: 'ROUND', signature: 'ROUND(number, digits)', description: 'Rounds to digits' },
  { name: 'MAX', signature: 'MAX(n1, n2, ...)', description: 'Returns largest value' },
  { name: 'MIN', signature: 'MIN(n1, n2, ...)', description: 'Returns smallest value' },
];

interface RelationshipField {
  relationshipName: string;
  fieldName: string;
  field: FieldDescribe;
  targetObject: string;
}

interface FormulaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  field: FieldDescribe | null;
  objectName: string;
  objectLabel: string;
  allFields: FieldDescribe[];
  onSaveSuccess: () => void;
}

/**
 * Monaco editor modal for editing formula fields with autocomplete.
 */
export function FormulaEditor({
  isOpen,
  onClose,
  field,
  objectName,
  objectLabel,
  allFields,
  onSaveSuccess,
}: FormulaEditorProps) {
  const editorRef = useRef<MonacoEditorRef>(null);
  const [formula, setFormula] = useState('');
  const [status, setStatus] = useState<{ text: string; type: '' | 'success' | 'error' }>({
    text: '',
    type: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldMetadata, setFieldMetadata] = useState<{
    id: string;
    metadata: Record<string, unknown>;
  } | null>(null);

  // Store completion provider disposable for cleanup
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);

  // Load formula metadata when modal opens
  useEffect(() => {
    if (!isOpen || !field) return;

    const loadFormula = async () => {
      setIsLoading(true);
      setStatus({ text: 'Loading formula...', type: '' });
      setFormula('Loading formula...');

      try {
        const metadata = await getFormulaFieldMetadata(objectName, field.name);
        setFieldMetadata({ id: metadata.id, metadata: metadata.metadata });
        setFormula(metadata.formula || '');
        setStatus({ text: '', type: '' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus({ text: `Error loading formula: ${message}`, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    loadFormula();

    // Register completion provider
    registerCompletionProvider(allFields);

    return () => {
      // Cleanup completion provider
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
        completionDisposableRef.current = null;
      }
    };
  }, [isOpen, field, objectName, allFields]);

  // Register Monaco completion provider for formula fields
  const registerCompletionProvider = useCallback(async (fields: FieldDescribe[]) => {
    // Clean up existing provider
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    // Build relationship fields
    const referenceFields = fields.filter(
      (f) => f.type === 'reference' && f.relationshipName && f.referenceTo?.length > 0
    );

    const relationshipFields: RelationshipField[] = [];
    const relatedObjectNames = [...new Set(referenceFields.flatMap((f) => f.referenceTo || []))];

    // Load related object fields
    const describes = await Promise.all(
      relatedObjectNames.map((name) => getObjectDescribe(name).catch(() => null))
    );

    const fieldsByObject = new Map<string, FieldDescribe[]>();
    relatedObjectNames.forEach((name, idx) => {
      if (describes[idx]) {
        fieldsByObject.set(name, describes[idx]!.fields || []);
      }
    });

    // Build relationship field suggestions
    for (const refField of referenceFields) {
      const relName = refField.relationshipName!;
      for (const targetObject of refField.referenceTo || []) {
        const targetFields = fieldsByObject.get(targetObject) || [];
        for (const targetField of targetFields) {
          relationshipFields.push({
            relationshipName: relName,
            fieldName: targetField.name,
            field: targetField,
            targetObject,
          });
        }
      }
    }

    // Register completion provider
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('apex', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Check for relationship traversal (after dot)
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        const dotMatch = textBeforeCursor.match(/(\w+)\.$/);

        const suggestions: languages.CompletionItem[] = [];

        if (dotMatch) {
          // Show fields for the relationship
          const relName = dotMatch[1].toLowerCase();
          const relatedFields = relationshipFields.filter(
            (rf) => rf.relationshipName.toLowerCase() === relName
          );

          for (const rf of relatedFields) {
            suggestions.push({
              label: rf.fieldName,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${rf.relationshipName}.${rf.fieldName} (${rf.field.type})`,
              documentation: rf.field.label,
              insertText: rf.fieldName,
              range,
            });
          }
        } else {
          // Show direct fields
          for (const f of fields) {
            suggestions.push({
              label: f.name,
              kind: f.calculated
                ? monaco.languages.CompletionItemKind.Constant
                : monaco.languages.CompletionItemKind.Field,
              detail: f.type + (f.calculated ? ' (formula)' : ''),
              documentation: f.label,
              insertText: f.name,
              range,
              sortText: `1_${f.name}`,
            });
          }

          // Show relationship names
          const relNames = [...new Set(relationshipFields.map((rf) => rf.relationshipName))];
          for (const relName of relNames) {
            suggestions.push({
              label: relName,
              kind: monaco.languages.CompletionItemKind.Module,
              detail: 'Relationship',
              documentation: `Access fields from related ${relName} record`,
              insertText: relName,
              range,
              sortText: `2_${relName}`,
            });
          }

          // Show formula functions
          for (const fn of FORMULA_FUNCTIONS) {
            suggestions.push({
              label: fn.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: fn.signature,
              documentation: fn.description,
              insertText: `${fn.name}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `3_${fn.name}`,
            });
          }
        }

        return { suggestions };
      },
    });
  }, []);

  const handleSave = async () => {
    if (!fieldMetadata || isSaving) return;

    setIsSaving(true);
    setStatus({ text: 'Saving...', type: '' });

    try {
      await updateFormulaField(fieldMetadata.id, formula, fieldMetadata.metadata);
      setStatus({ text: 'Formula saved successfully!', type: 'success' });

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
        onSaveSuccess();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ text: `Error saving: ${message}`, type: 'error' });
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    setFormula('');
    setFieldMetadata(null);
    setStatus({ text: '', type: '' });
    onClose();
  }, [onClose]);

  if (!field) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className={styles.formulaModal}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Edit Formula</h3>
            <div className={styles.modalFieldInfo}>
              {objectLabel} &gt; {field.label} ({field.name})
            </div>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} title="Close">
            <SfIcon name="close" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalEditorContainer}>
            <MonacoEditor
              ref={editorRef}
              language="apex"
              value={formula}
              onChange={setFormula}
              readonly={isLoading}
              resizable={false}
              className={styles.monacoContainer}
            />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <div className={`${styles.modalStatus}${status.type ? ` ${styles[status.type]}` : ''}`}>
            {status.text}
          </div>
          <button className="button-neutral" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="button-brand"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
