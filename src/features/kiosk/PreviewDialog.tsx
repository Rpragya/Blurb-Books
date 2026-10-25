import { useBook } from '../../api/queries';
import { ButtonLink } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { Dialog } from '../../ui/Dialog';
import { ErrorState, Spinner } from '../../ui/Feedback';
import { AvailabilityBadge } from '../../ui/Status';
import { PreviewText } from './PreviewText';

/**
 * Quick look at a book without leaving the results. Its open state lives in
 * the URL (?preview=id) so it can be linked to and closed with Back.
 */
export function PreviewDialog({ editionId, onClose }: { editionId: string; onClose: () => void }) {
  const book = useBook(editionId);
  const edition = book.data?.edition;

  return (
    <Dialog
      title={edition ? edition.title : 'Preview'}
      description={edition ? `by ${edition.authors.join(', ')}` : undefined}
      onClose={onClose}
      size="lg"
      footer={
        edition && (
          <>
            {book.data!.availability.onShelf > 0 && (
              <ButtonLink to={`/books/${edition.id}/locate`} icon="pin">
                Locate on the shelf
              </ButtonLink>
            )}
            <ButtonLink to={`/books/${edition.id}`} variant="primary" iconEnd="chevron">
              Full details
            </ButtonLink>
          </>
        )
      }
    >
      {book.isPending ? (
        <Spinner label="Loading preview" />
      ) : book.isError ? (
        <ErrorState error={book.error} onRetry={() => book.refetch()} />
      ) : (
        <div className="preview-dialog">
          <Cover edition={book.data.edition} size="sm" />
          <div className="stack">
            <AvailabilityBadge availability={book.data.availability} showDetail />
            <p className="preview-dialog__description">{book.data.edition.description}</p>
            <PreviewText preview={book.data.edition.preview} compact />
          </div>
        </div>
      )}
    </Dialog>
  );
}
