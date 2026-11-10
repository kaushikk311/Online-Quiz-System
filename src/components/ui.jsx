import { useEffect, useRef } from 'react';
import { navigate } from '../router.js';

export const Button = ({ variant = 'primary', small, className = '', type = 'button', ...p }) => (
  <button type={type} className={`btn btn-${variant}${small ? ' btn-sm' : ''} ${className}`} {...p} />
);

export function Field({ id, label, error, hint, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <p className="error-text" id={`${id}-err`} role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Notice = ({ tone = 'info', title, children, action }) => (
  <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <div>{title && <strong>{title}</strong>}{children && <p>{children}</p>}</div>
    {action}
  </div>
);

export const Badge = ({ tone = 'neutral', children }) => <span className={`badge badge-${tone}`}>{children}</span>;

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const EmptyState = ({ title, children, action }) => (
  <div className="empty">
    <span className="empty-mark" aria-hidden="true" />
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <Notice tone="error" title="Couldn’t load this page" action={onRetry && <Button variant="secondary" small onClick={onRetry}>Try again</Button>}>{message}</Notice>
);

export const AccessDenied = ({ title = 'You can’t open this page', message, backTo = '/', backLabel = 'Go back' }) => (
  <div className="empty denied">
    <span className="empty-mark empty-mark-x" aria-hidden="true" />
    <h3>{title}</h3>
    <p>{message || 'Your role does not have permission to see this page.'}</p>
    <Button variant="secondary" onClick={() => navigate(backTo)}>{backLabel}</Button>
  </div>
);

export function Modal({ title, onClose, children, footer, wide, locked }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !locked) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose, locked]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose?.(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head"><h2>{title}</h2>{!locked && <button className="icon-btn" aria-label="Close" onClick={onClose}>×</button>}</div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const ConfirmDialog = ({ title, message, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onCancel, error }) => (
  <Modal title={title} onClose={onCancel} footer={<><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button></>}>
    {typeof message === 'string' ? <p>{message}</p> : message}
    {error && <Notice tone="error">{error}</Notice>}
  </Modal>
);
