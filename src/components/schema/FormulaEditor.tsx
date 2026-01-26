import { useState, useRef, useCallback, useEffect } from 'react';
import type { FieldDescribe } from '../../types/salesforce';
import { Modal } from '../modal/Modal';
import { MonacoEditor, type MonacoEditorRef, monaco } from '../monaco-editor/MonacoEditor';
import { SfIcon } from '../sf-icon/SfIcon';
import {
  getFormulaFieldMetadata,
  updateFormulaField,
  getObjectDescribe,
} from '../../lib/salesforce';
import type { languages } from 'monaco-editor';
import styles from './SchemaPage.module.css';

// Formula functions for autocomplete - comprehensive list
const FORMULA_FUNCTIONS = [
  // Logical Functions
  { name: 'IF', signature: 'IF(logical_test, value_if_true, value_if_false)', description: 'Returns one value if a condition is true and another if false' },
  { name: 'CASE', signature: 'CASE(expression, value1, result1, value2, result2, ..., else_result)', description: 'Compares an expression to a series of values and returns the corresponding result' },
  { name: 'AND', signature: 'AND(logical1, logical2, ...)', description: 'Returns TRUE if all arguments are true' },
  { name: 'OR', signature: 'OR(logical1, logical2, ...)', description: 'Returns TRUE if any argument is true' },
  { name: 'NOT', signature: 'NOT(logical)', description: 'Returns TRUE if the argument is false' },
  { name: 'ISBLANK', signature: 'ISBLANK(expression)', description: 'Returns TRUE if the expression is blank' },
  { name: 'ISNULL', signature: 'ISNULL(expression)', description: 'Returns TRUE if the expression is null' },
  { name: 'ISCHANGED', signature: 'ISCHANGED(field)', description: 'Returns TRUE if the field value has changed (validation/workflow only)' },
  { name: 'ISNEW', signature: 'ISNEW()', description: 'Returns TRUE if the record is new (validation/workflow only)' },
  { name: 'PRIORVALUE', signature: 'PRIORVALUE(field)', description: 'Returns the previous value of a field (validation/workflow only)' },
  { name: 'BLANKVALUE', signature: 'BLANKVALUE(expression, substitute)', description: 'Returns substitute if expression is blank, otherwise returns expression' },
  { name: 'NULLVALUE', signature: 'NULLVALUE(expression, substitute)', description: 'Returns substitute if expression is null, otherwise returns expression' },

  // Text Functions
  { name: 'TEXT', signature: 'TEXT(value)', description: 'Converts a value to text' },
  { name: 'VALUE', signature: 'VALUE(text)', description: 'Converts text to a number' },
  { name: 'LEN', signature: 'LEN(text)', description: 'Returns the number of characters in a text string' },
  { name: 'LEFT', signature: 'LEFT(text, num_chars)', description: 'Returns the leftmost characters from a text string' },
  { name: 'RIGHT', signature: 'RIGHT(text, num_chars)', description: 'Returns the rightmost characters from a text string' },
  { name: 'MID', signature: 'MID(text, start_num, num_chars)', description: 'Returns characters from the middle of a text string' },
  { name: 'LOWER', signature: 'LOWER(text)', description: 'Converts text to lowercase' },
  { name: 'UPPER', signature: 'UPPER(text)', description: 'Converts text to uppercase' },
  { name: 'TRIM', signature: 'TRIM(text)', description: 'Removes leading and trailing spaces' },
  { name: 'CONTAINS', signature: 'CONTAINS(text, compare_text)', description: 'Returns TRUE if text contains compare_text' },
  { name: 'BEGINS', signature: 'BEGINS(text, compare_text)', description: 'Returns TRUE if text begins with compare_text' },
  { name: 'FIND', signature: 'FIND(search_text, text, start_num)', description: 'Returns the position of search_text within text' },
  { name: 'SUBSTITUTE', signature: 'SUBSTITUTE(text, old_text, new_text)', description: 'Substitutes new_text for old_text in a text string' },
  { name: 'BR', signature: 'BR()', description: 'Inserts a line break in a text string' },
  { name: 'HYPERLINK', signature: 'HYPERLINK(url, friendly_name, target)', description: 'Creates a hyperlink' },
  { name: 'IMAGE', signature: 'IMAGE(image_url, alt_text, height, width)', description: 'Inserts an image' },
  { name: 'ISPICKVAL', signature: 'ISPICKVAL(picklist_field, text_literal)', description: 'Returns TRUE if picklist value equals text' },
  { name: 'REGEX', signature: 'REGEX(text, regex_text)', description: 'Returns TRUE if text matches the regular expression' },
  { name: 'LPAD', signature: 'LPAD(text, padded_length, pad_string)', description: 'Pads text on the left with specified characters' },
  { name: 'RPAD', signature: 'RPAD(text, padded_length, pad_string)', description: 'Pads text on the right with specified characters' },

  // Date/Time Functions
  { name: 'TODAY', signature: 'TODAY()', description: 'Returns the current date' },
  { name: 'NOW', signature: 'NOW()', description: 'Returns the current date and time' },
  { name: 'DATE', signature: 'DATE(year, month, day)', description: 'Creates a date from year, month, and day' },
  { name: 'DATEVALUE', signature: 'DATEVALUE(expression)', description: 'Converts a datetime or text to a date' },
  { name: 'DATETIMEVALUE', signature: 'DATETIMEVALUE(expression)', description: 'Converts text to a datetime' },
  { name: 'YEAR', signature: 'YEAR(date)', description: 'Returns the year of a date' },
  { name: 'MONTH', signature: 'MONTH(date)', description: 'Returns the month of a date (1-12)' },
  { name: 'DAY', signature: 'DAY(date)', description: 'Returns the day of the month (1-31)' },
  { name: 'WEEKDAY', signature: 'WEEKDAY(date)', description: 'Returns the day of the week (1=Sunday, 7=Saturday)' },
  { name: 'ADDMONTHS', signature: 'ADDMONTHS(date, num)', description: 'Adds months to a date' },
  { name: 'HOUR', signature: 'HOUR(datetime)', description: 'Returns the hour of a datetime (0-23)' },
  { name: 'MINUTE', signature: 'MINUTE(datetime)', description: 'Returns the minute of a datetime (0-59)' },
  { name: 'SECOND', signature: 'SECOND(datetime)', description: 'Returns the second of a datetime (0-59)' },
  { name: 'MILLISECOND', signature: 'MILLISECOND(datetime)', description: 'Returns the millisecond of a datetime (0-999)' },
  { name: 'TIMENOW', signature: 'TIMENOW()', description: 'Returns the current time' },
  { name: 'TIMEVALUE', signature: 'TIMEVALUE(text)', description: 'Converts text to a time' },

  // Math Functions
  { name: 'ABS', signature: 'ABS(number)', description: 'Returns the absolute value of a number' },
  { name: 'CEILING', signature: 'CEILING(number)', description: 'Rounds a number up to the nearest integer' },
  { name: 'FLOOR', signature: 'FLOOR(number)', description: 'Rounds a number down to the nearest integer' },
  { name: 'ROUND', signature: 'ROUND(number, num_digits)', description: 'Rounds a number to a specified number of digits' },
  { name: 'MCEILING', signature: 'MCEILING(number)', description: 'Rounds a number up, away from zero' },
  { name: 'MFLOOR', signature: 'MFLOOR(number)', description: 'Rounds a number down, toward zero' },
  { name: 'MAX', signature: 'MAX(number1, number2, ...)', description: 'Returns the largest value' },
  { name: 'MIN', signature: 'MIN(number1, number2, ...)', description: 'Returns the smallest value' },
  { name: 'MOD', signature: 'MOD(number, divisor)', description: 'Returns the remainder after division' },
  { name: 'SQRT', signature: 'SQRT(number)', description: 'Returns the square root of a number' },
  { name: 'EXP', signature: 'EXP(number)', description: 'Returns e raised to the power of number' },
  { name: 'LN', signature: 'LN(number)', description: 'Returns the natural logarithm of a number' },
  { name: 'LOG', signature: 'LOG(number)', description: 'Returns the base-10 logarithm of a number' },
  { name: 'TRUNC', signature: 'TRUNC(number, num_digits)', description: 'Truncates a number to specified digits' },
  { name: 'GEOLOCATION', signature: 'GEOLOCATION(latitude, longitude)', description: 'Creates a geolocation value' },
  { name: 'DISTANCE', signature: 'DISTANCE(location1, location2, unit)', description: 'Returns the distance between two locations' },

  // Advanced Functions
  { name: 'CURRENCYRATE', signature: 'CURRENCYRATE(IsoCode)', description: 'Returns the conversion rate to the corporate currency' },
  { name: 'GETRECORDIDS', signature: 'GETRECORDIDS(object_type)', description: 'Returns an array of record IDs (Flow only)' },
  { name: 'HTMLENCODE', signature: 'HTMLENCODE(text)', description: 'Encodes text for HTML' },
  { name: 'JSENCODE', signature: 'JSENCODE(text)', description: 'Encodes text for JavaScript' },
  { name: 'JSINHTMLENCODE', signature: 'JSINHTMLENCODE(text)', description: 'Encodes text for JavaScript inside HTML' },
  { name: 'URLENCODE', signature: 'URLENCODE(text)', description: 'Encodes text for URLs' },
  { name: 'INCLUDE', signature: 'INCLUDE(s_control_name, inputs)', description: 'Includes an S-Control (legacy)' },
  { name: 'GETSESSIONID', signature: 'GETSESSIONID()', description: 'Returns the current session ID' },
  { name: 'LINKTO', signature: 'LINKTO(label, target, id, inputs, no_override)', description: 'Creates a relative URL link' },
  { name: 'URLFOR', signature: 'URLFOR(target, id, inputs, no_override)', description: 'Returns a relative URL' },
  { name: 'REQUIRESCRIPT', signature: 'REQUIRESCRIPT(url)', description: 'Includes a JavaScript file' },
  { name: 'IMAGEPROXYURL', signature: 'IMAGEPROXYURL(url)', description: 'Returns a proxied image URL' },
  { name: 'PARENTGROUPVAL', signature: 'PARENTGROUPVAL(summary_field, grouping_level)', description: 'Returns parent grouping value (reports only)' },
  { name: 'PREVGROUPVAL', signature: 'PREVGROUPVAL(summary_field, grouping_level, increment)', description: 'Returns previous grouping value (reports only)' },

  // Picklist Functions
  { name: 'INCLUDES', signature: 'INCLUDES(multiselect_picklist, text_literal)', description: 'Returns TRUE if multi-select picklist includes value' },
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
