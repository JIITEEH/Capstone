import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Archive as ArchiveIcon, Search } from 'lucide-react';
import { EmptyState, LoadState, Spinner } from '../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import Pagination from '../ui-pieces/basics/Pagination.jsx';
import useApi from '../reusable-logic/useApi.js';
import usePage from '../reusable-logic/usePage.js';
import { api } from '../api-client/api.js';
import { parseDate } from '../helpers/format.js';

export const keywordList = (keywords) => keywords.split(',').map((k) => k.trim()).filter(Boolean);

// A read-only library of finished theses, so new groups can see what past work looked like
export default function Archive() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = usePage({ search, year });
  const { data, loading, error, reload } = useApi(() => api.listArchive({ search, year, page }), [search, year, page]);
  const theses = data?.items;
  const filtered = Boolean(search || year);

  return (
    <>
      <PageHeader title="Thesis archive" subtitle="Browse completed theses for ideas on topics, scope, and writing." />

      <section className="card card-flush">
        <div className="toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by title, abstract, keyword, or student"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search the archive"
            />
          </label>
          {data?.years.length > 0 && (
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
              <option value="">All years</option>
              {data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {loading && theses && <Spinner size={18} />}
        </div>

        {!theses ? (
          <div className="card-pad">
            <LoadState loading={loading} error={error} onRetry={reload} />
          </div>
        ) : theses.length === 0 ? (
          <EmptyState
            icon={ArchiveIcon}
            title={filtered ? 'No theses match your search' : 'No completed theses yet'}
            message={filtered ? 'Try other words or another year.' : 'Theses appear here once every stage is approved.'}
          />
        ) : (
          <ul className="archive-list">
            {theses.map((thesis) => (
              <li key={thesis.id} className="archive-item">
                <Link to={`/archive/${thesis.id}`} className="archive-title">
                  {thesis.title}
                </Link>
                <span className="muted small">
                  {thesis.student_name}
                  {thesis.student_program && ` · ${thesis.student_program}`} · {parseDate(thesis.completed_at).getFullYear()}
                </span>
                {thesis.abstract && <p className="clamp-2 archive-abstract">{thesis.abstract}</p>}
                {thesis.keywords && (
                  <div className="chips">
                    {keywordList(thesis.keywords).map((keyword) => (
                      <span key={keyword} className="chip">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination {...data} onChange={setPage} />}
      </section>
    </>
  );
}
