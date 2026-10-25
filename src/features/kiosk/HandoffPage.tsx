import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeading, usePageTitle } from '../../app/focus';
import { Button, ButtonLink } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const ALLOWED = [/^\/books\/[\w-]+(\/locate)?(\?copy=[\w-]+)?$/, /^\/search(\?.*)?$/, /^\/map$/];

/** Only same-origin public routes can be handed off — never an arbitrary URL. */
export function safeHandoffPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return ALLOWED.some((re) => re.test(raw)) ? raw : null;
}

export function HandoffPage() {
  usePageTitle('Continue on your phone');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const path = safeHandoffPath(params.get('to'));
  const url = path ? new URL(path, window.location.origin).toString() : null;

  return (
    <div className="container narrow-page handoff">
      <p className="eyebrow">Continue on your phone</p>
      <PageHeading>Scan to take this with you</PageHeading>
      {url ? (
        <>
          <div className="handoff__card">
            <QRCodeSVG value={url} size={260} level="M" marginSize={2} title="QR code linking to this page" className="handoff__qr" />
            <ol className="handoff__steps">
              <li>Open your phone’s camera.</li>
              <li>Point it at the code until a link appears.</li>
              <li>Tap the link to open this page on your phone.</li>
            </ol>
          </div>
          <p className="handoff__url">
            Or type: <span className="barcode">{url}</span>
          </p>
          <p className="handoff__privacy">
            <Icon name="info" size={16} /> The code contains only this public link — no personal or account information.
          </p>
        </>
      ) : (
        <p>There’s nothing to hand off from here. Open a book or the map first.</p>
      )}
      <div className="handoff__actions">
        <Button variant="primary" icon="back" onClick={() => navigate(-1)}>
          Back
        </Button>
        <ButtonLink to="/" variant="ghost">
          Start again
        </ButtonLink>
      </div>
    </div>
  );
}
