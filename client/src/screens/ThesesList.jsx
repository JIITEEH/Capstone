import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Download, Library, Search } from 'lucide-react';
import { ThesisStatusBadge } from '../ui-pieces/basics/Badge.jsx';
import { EmptyState, LoadState, Spinner } from '../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import Pagination from '../ui-pieces/basics/Pagination.jsx';
import { ProgressBar } from '../ui-pieces/basics/StageTracker.jsx';
import { DueNote } from '../ui-pieces/thesis/DueBadge.jsx';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import usePage from '../reusable-logic/usePage.js';
import { api } from '../api-client/api.js';
import { STAGES, THESIS_STATUS } from '../helpers/constants.js';
import { formatDate } from '../helpers/format.js';

export default function ThesesList() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const adviser = params.get('adviser') ?? '';
  const term = params.get('term') ?? '';
  const deadline = params.get('deadline') ?? '';

  // The topbar search arrives as ?q=
  const query = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(query);
  const [search, setSearch] = useState(query.trim());
  useEffect(() => {
    setSearchInput(query);
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = { status, adviser: isAdmin ? adviser : '', term: isAdmin ? term : '', deadline, search };
  const [page, setPage] = usePage(filters);
  const { data, loading, error } = useApi(
    () => api.listTheses({ ...filters, page }),
    [status, adviser, term, deadline, search, isAdmin, page],
  );
  const theses = data?.items;
  const { data: advisers } = useApi(() => (isAdmin ? api.listAdvisers() : Promise.resolve([])), [isAdmin]);
  const { data: terms } = useApi(() => (isAdmin ? api.listTerms() : Promise.resolve([])), [isAdmin]);

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const hasFilters = Boolean(status || adviser || term || deadline || search);

  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  // Exports exactly what is on screen: the same filters and search
  async function exportCsv() {
    setExporting(true);
    try {
      await api.exportTheses({ status, adviser, term, deadline, search });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All theses' : 'My advisees'}
        subtitle={isAdmin ? 'Search, filter, and manage every thesis.' : 'Theses you have been assigned to advise.'}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
              <Download size={16} />
              {exporting ? 'Preparing…' : 'Export CSV'}
            </button>
          )
        }
      />

      <section className="card card-flush">
        <div className="toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by title, student, or keyword"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search theses"
            />
          </label>
          <select className="input" value={status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.entries(THESIS_STATUS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <select className="input" value={adviser} onChange={(e) => setFilter('adviser', e.target.value)} aria-label="Filter by adviser">
              <option value="">All advisers</option>
              <option value="unassigned">Not assigned</option>
              {advisers?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {isAdmin && terms?.length > 0 && (
            <select className="input" value={term} onChange={(e) => setFilter('term', e.target.value)} aria-label="Filter by term">
              <option value="">All terms</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="none">No term</option>
            </select>
          )}
          <select className="input" value={deadline} onChange={(e) => setFilter('deadline', e.target.value)} aria-label="Filter by deadline">
            <option value="">Any deadline</option>
            <option value="overdue">Overdue</option>
          </select>
          {loading && theses && <Spinner size={18} />}
        </div>

        {!theses ? (
          <div className="card-pad">
            <LoadState loading={loading} error={error} />
          </div>
        ) : theses.length === 0 ? (
          <EmptyState
            icon={Library}
            title={hasFilters ? 'No theses match your filters' : 'No theses yet'}
            message={hasFilters ? 'Try a different search or clear the filters.' : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thesis</th>
                  <th>Students</th>
                  {isAdmin && <th className="hide-tablet">Adviser</th>}
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="hide-tablet">Updated</th>
                </tr>
              </thead>
              <tbody>
                {theses.map((thesis) => (
                  <tr key={thesis.id} className="row-clickable" onClick={() => navigate(`/theses/${thesis.id}`)}>
                    <td className="cell-title" data-label="Thesis">
                      <Link to={`/theses/${thesis.id}`} onClick={(e) => e.stopPropagation()}>
                        {thesis.title}
                      </Link>
                      {thesis.keywords && <span className="cell-sub clamp-1">{thesis.keywords}</span>}
                    </td>
                    <td data-label="Students">
                      <span className="nowrap">{thesis.student_name}</span>
                      <span className="cell-sub">{thesis.student_program}</span>
                    </td>
                    {isAdmin && (
                      <td className="hide-tablet" data-label="Adviser">
                        {thesis.adviser_name ?? <span className="text-danger">Not assigned</span>}
                      </td>
                    )}
                    <td data-label="Progress">
                      <ProgressBar value={thesis.approved_stages} max={STAGES.length} />
                      <DueNote thesis={thesis} />
                    </td>
                    <td data-label="Status">
                      <ThesisStatusBadge status={thesis.status} />
                    </td>
                    <td className="hide-tablet nowrap muted" data-label="Updated">{formatDate(thesis.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination {...data} onChange={setPage} />}
      </section>
    </>
  );
}
