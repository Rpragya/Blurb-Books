import { Icon } from './Icon';

export function Badge({ tone, icon, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

const AVAILABILITY_TONE = {
  available: ['ok', 'check'],
  reference_only: ['info', 'book'],
  reshelving: ['warn', 'refresh'],
  all_on_loan: ['neutral', 'clock'],
  unavailable: ['danger', 'alert'],
  no_copies: ['neutral', 'info'],
};

export function AvailabilityBadge({ availability, showDetail = false }) {
  const [tone, icon] = AVAILABILITY_TONE[availability.kind];
  return (
    <span className="availability">
      <Badge tone={tone} icon={icon}>
        {availability.label}
      </Badge>
      {showDetail && availability.detail && <span className="availability__detail">{availability.detail}</span>}
    </span>
  );
}

const COPY_STATUS = {
  available: ['On the shelf', 'ok', 'check'],
  on_loan: ['On loan', 'neutral', 'clock'],
  in_library_use: ['In a reading session', 'info', 'book'],
  awaiting_reshelving: ['Awaiting reshelving', 'warn', 'refresh'],
  on_hold_shelf: ['On hold shelf', 'accent', 'bookmark'],
  missing: ['Missing', 'danger', 'alert'],
  in_repair: ['In repair', 'danger', 'alert'],
};

export function CopyStatusBadge({ status, policy }) {
  const [label, tone, icon] = COPY_STATUS[status];
  return (
    <Badge tone={tone} icon={icon}>
      {status === 'available' && policy === 'reference' ? 'On the shelf · in-library use' : label}
    </Badge>
  );
}

export function copyStatusText(status) {
  return COPY_STATUS[status][0];
}

const LOAN = {
  on_loan: ['On loan', 'neutral', 'clock'],
  due_soon: ['Due soon', 'warn', 'clock'],
  overdue: ['Overdue', 'danger', 'alert'],
  returned: ['Returned', 'ok', 'check'],
};

export function LoanStateBadge({ state, daysOverdue }) {
  const [label, tone, icon] = LOAN[state];
  return (
    <Badge tone={tone} icon={icon}>
      {state === 'overdue' && daysOverdue ? `Overdue ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'}` : label}
    </Badge>
  );
}

/** Inline message block. Always includes an icon and text, never colour alone. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  role,
}) {
  const icon = tone === 'ok' ? 'check' : tone === 'danger' || tone === 'warn' ? 'alert' : 'info';
  return (
    <div className={`notice notice--${tone}`} role={role}>
      <Icon name={icon} size={20} />
      <div className="notice__content">
        {title && <p className="notice__title">{title}</p>}
        {children && <div className="notice__body">{children}</div>}
      </div>
      {action && <div className="notice__action">{action}</div>}
    </div>
  );
}
