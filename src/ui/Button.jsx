import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

function classes(variant, size, extra) {
  return ['btn', `btn--${variant}`, `btn--${size}`, extra].filter(Boolean).join(' ');
}

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconEnd, loading, disabled, className, children, type = 'button', onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes(variant, size, className)}
      // aria-disabled keeps the button focusable so its explanation can be read.
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading ? <span className="spinner spinner--inline" aria-hidden="true" /> : icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={18} />}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconEnd, className, children, ...rest }) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={18} />}
    </Link>
  );
}
