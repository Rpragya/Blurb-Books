import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconEnd?: IconName;
  children?: ReactNode;
}

function classes(variant: Variant, size: Size, extra?: string) {
  return ['btn', `btn--${variant}`, `btn--${size}`, extra].filter(Boolean).join(' ');
}

export interface ButtonProps extends CommonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows a spinner, sets aria-busy and blocks further clicks. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
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

export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconEnd, className, children, ...rest }: CommonProps & LinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={18} />}
    </Link>
  );
}
