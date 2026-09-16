import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Library, Search } from 'lucide-react';
import { ThesisStatusBadge } from '../ui-pieces/basics/Badge.jsx';
import { EmptyState, LoadState, Spinner } from '../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import { ProgressBar } from '../ui-pieces/basics/StageTracker.jsx';
import { useAuth } from '../shared-state/AuthContext.jsx';
import useApi from '../reusable-logic/useApi.js';
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

  const { data: theses, loading, error } = useApi(
    () => api.listTheses({ status, adviser: isAdmin ? adviser : '', search }),
    [status, adviser, search, isAdmin],
  );
  const { data: advisers } = useApi(() => (isAdmin ? api.listAdvisers() : Promise.resolve([])), [isAdmin]);

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const hasFilters = Boolean(status || adviser || search);

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All theses' : 'My advisees'}
        subtitle={isAdmin ? 'Search, filter, and manage every thesis.' : 'Theses you have been assigned to advise.'}
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
                    <td className="cell-title">
                      <Link to={`/theses/${thesis.id}`} onClick={(e) => e.stopPropagation()}>
                        {thesis.title}
                      </Link>
                      {thesis.keywords && <span className="cell-sub clamp-1">{thesis.keywords}</span>}
                    </td>
                    <td>
                      <span className="nowrap">{thesis.student_name}</span>
                      <span className="cell-sub">{thesis.student_program}</span>
                    </td>
                    {isAdmin && (
                      <td className="hide-tablet">
                        {thesis.adviser_name ?? <span className="text-danger">Not assigned</span>}
                      </td>
                    )}
                    <td>
                      <ProgressBar value={thesis.approved_stages} max={STAGES.length} />
                    </td>
                    <td>
                      <ThesisStatusBadge status={thesis.status} />
                    </td>
                    <td className="hide-tablet nowrap muted">{formatDate(thesis.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
