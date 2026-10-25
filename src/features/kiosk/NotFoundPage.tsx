import { PageHeading, usePageTitle } from '../../app/focus';
import { ButtonLink } from '../../ui/Button';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="container narrow-page">
      <PageHeading>This page isn’t on our shelves</PageHeading>
      <p>The link may be old or mistyped.</p>
      <p>
        <ButtonLink to="/" variant="primary">
          Back to the welcome screen
        </ButtonLink>
      </p>
    </div>
  );
}
