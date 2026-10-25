import { useState } from 'react';
import { useOnline } from '../../api/ApiContext';
import { useLibraryMutation } from '../../api/queries';
import type { CopyReportKind } from '../../domain/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { errorMessage } from '../../ui/Feedback';
import { Field } from '../../ui/Field';
import { Notice } from '../../ui/Status';

const KINDS: [CopyReportKind, string][] = [
  ['not_on_shelf', 'It isn’t on the shelf'],
  ['misplaced', 'I found it in the wrong place'],
  ['damaged', 'It’s damaged'],
];

export function ReportCopyDialog({ copyId, title, where, onClose }: { copyId: string; title: string; where?: string; onClose: () => void }) {
  const [kind, setKind] = useState<CopyReportKind>('not_on_shelf');
  const [note, setNote] = useState('');
  const online = useOnline();
  const report = useLibraryMutation((api, vars: { kind: CopyReportKind; note: string }, opts) =>
    api.reportCopyIssue({ copyId, source: 'kiosk', ...vars }, opts),
  );

  if (report.isSuccess) {
    return (
      <Dialog title="Thanks — staff have been told" onClose={onClose} size="sm" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <p>
          A librarian will check {where ? <strong>{where}</strong> : 'the shelf'}. If you’d like help now, the help desk is by the
          entrance.
        </p>
        <p className="muted">Demo: the report is stored in this browser and appears in the librarian workspace.</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Couldn’t find this book?"
      description={`Let staff know about “${title}”. No personal details needed.`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="report-form" loading={report.isPending} disabled={!online}>
            Send report
          </Button>
        </>
      }
    >
      <form
        id="report-form"
        onSubmit={(e) => {
          e.preventDefault();
          report.mutate({ kind, note });
        }}
        className="stack"
      >
        <fieldset className="radio-group">
          <legend>What happened?</legend>
          {KINDS.map(([value, label]) => (
            <label key={value} className="radio-row">
              <input type="radio" name="report-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <Field label="Anything else? (optional)" hint="For example, where you found it.">
          <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {!online && <Notice tone="warn">You’re offline. Reports can be sent once the connection is back.</Notice>}
        {report.isError && (
          <Notice tone="danger" role="alert" title="Report not sent">
            {errorMessage(report.error)} Your answers are still here — try again.
          </Notice>
        )}
      </form>
    </Dialog>
  );
}
