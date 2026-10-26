import { cloneElement, useId } from 'react';
import { Icon } from './Icon';

export function Field({ label, hint, error, children, className, labelHidden }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['field', error ? 'field--error' : '', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={labelHidden ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        className: ['input', children.props.className].filter(Boolean).join(' '),
      })}
      {error && (
        <p id={errorId} className="field__error">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  );
}
