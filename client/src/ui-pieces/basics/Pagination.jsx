import { ChevronLeft, ChevronRight } from 'lucide-react';

// Previous and Next for a list the API sends a page at a time. Hidden when everything fits on one page.
export default function Pagination({ page, pages, total, pageSize, onChange }) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function go(next) {
    onChange(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <nav className="pagination" aria-label="Pages">
      <span className="muted">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination-buttons">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft size={16} />
          Previous
        </button>
        <span className="pagination-page" aria-current="page">
          Page {page} of {pages}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => go(page + 1)}>
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
