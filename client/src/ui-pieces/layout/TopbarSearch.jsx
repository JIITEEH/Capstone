import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { FileText, Library, Search, User } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { api } from '../../api-client/api.js';
import { ROLES, STAGE_LABELS, SUBMISSION_STATUS, THESIS_STATUS } from '../../helpers/constants.js';
import { formatDate, plural } from '../../helpers/format.js';
import { Spinner } from '../basics/Feedback.jsx';

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

// Where each result opens. Students have one thesis page; advisers reach a student through
// their thesis; admins manage people from the Users page.
function thesisPath(role, id) {
  return role === 'student' ? '/thesis' : `/theses/${id}`;
}

function personPath(role, person) {
  if (role === 'admin') return `/users?q=${encodeURIComponent(person.email)}`;
  return thesisPath(role, person.thesis_id);
}

// Turns the grouped API response into one flat list, so arrow keys move through every group in order
function toGroups(role, results, query) {
  const groups = [
    {
      key: 'theses',
      label: 'Theses',
      icon: Library,
      options: results.theses.map((thesis) => ({
        key: `thesis-${thesis.id}`,
        href: thesisPath(role, thesis.id),
        title: thesis.title,
        detail: [thesis.student_name, THESIS_STATUS[thesis.status]?.label].filter(Boolean).join(' · '),
      })),
    },
    {
      key: 'people',
      label: 'People',
      icon: User,
      options: results.people.map((person) => ({
        key: `person-${person.id}`,
        href: personPath(role, person),
        title: person.name,
        detail: [ROLES[person.role]?.label, person.email, person.is_active ? '' : 'Deactivated']
          .filter(Boolean)
          .join(' · '),
      })),
    },
    {
      key: 'submissions',
      label: 'Submissions',
      icon: FileText,
      options: results.submissions.map((submission) => ({
        key: `submission-${submission.id}`,
        href: `/submissions/${submission.id}`,
        title: `${STAGE_LABELS[submission.stage] ?? submission.stage}: ${submission.file_name}`,
        detail: [
          role === 'student' ? '' : submission.student_name,
          SUBMISSION_STATUS[submission.status]?.label,
          formatDate(submission.submitted_at),
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    },
  ].filter((group) => group.options.length);

  // The dropdown shows a few of each; these open the full, filterable lists
  const more = [];
  if (role !== 'student' && results.theses.length) {
    more.push({ key: 'all-theses', href: `/theses?q=${encodeURIComponent(query)}`, title: `All theses matching “${query}”` });
  }
  if (role === 'admin' && results.people.length) {
    more.push({ key: 'all-users', href: `/users?q=${encodeURIComponent(query)}`, title: `All users matching “${query}”` });
  }
  if (more.length) groups.push({ key: 'more', label: 'See more', icon: Search, options: more });

  let index = 0;
  for (const group of groups) {
    for (const option of group.options) option.index = index++;
  }
  return groups;
}

// Searches theses, people, and submissions the signed-in user can open.
// Follows the WAI-ARIA combobox pattern: focus stays in the input while arrow keys move the highlight.
// Cmd/Ctrl+K focuses it from anywhere.
export default function TopbarSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const listboxId = useId();
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const latestRequest = useRef(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ results: null, loading: false, error: '' });
  const [active, setActive] = useState(-1);

  const term = query.trim();
  const searchable = term.length >= MIN_LENGTH;
  const groups = searchable && state.results ? toGroups(user.role, state.results, term) : [];
  const options = groups.flatMap((group) => group.options);
  const resultCount = groups.filter((group) => group.key !== 'more').reduce((sum, g) => sum + g.options.length, 0);
  const showPanel = open && searchable;
  const optionId = (index) => `${listboxId}-option-${index}`;

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!searchable) {
      setState({ results: null, loading: false, error: '' });
      return undefined;
    }
    setState((prev) => ({ ...prev, loading: true }));
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      try {
        const results = await api.search(term);
        // A slower, older request must not overwrite the results for what's typed now
        if (request === latestRequest.current) setState({ results, loading: false, error: '' });
      } catch (err) {
        if (request === latestRequest.current) setState({ results: null, loading: false, error: err.message });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, searchable]);

  useEffect(() => {
    setActive(-1);
  }, [state.results]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // optionId only depends on listboxId, which never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function go(href) {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(href);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (!options.length) return;
      const last = options.length - 1;
      if (event.key === 'ArrowDown') setActive((index) => (index < last ? index + 1 : 0));
      else setActive((index) => (index > 0 ? index - 1 : last));
    } else if (event.key === 'Escape') {
      if (showPanel) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        event.preventDefault();
        setQuery('');
      }
    }
  }

  function submit(event) {
    event.preventDefault();
    // Enter opens the highlighted result, or the first one when nothing is highlighted
    const option = options[active] ?? options[0];
    if (option) go(option.href);
  }

  const placeholder = user.role === 'student' ? 'Search your thesis and group' : 'Search theses, people, submissions';
  let status = '';
  if (searchable && !state.loading) {
    if (state.error) status = state.error;
    else if (state.results) status = resultCount ? `${plural(resultCount, 'result')}. Use the up and down arrows to choose.` : 'No results';
  }

  return (
    <div className="topbar-search-wrap" ref={rootRef}>
      <form className="topbar-search" role="search" onSubmit={submit}>
        <Search size={22} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {showPanel && state.loading ? <Spinner size={18} /> : <kbd className="kbd" aria-hidden="true">{IS_MAC ? '⌘ K' : 'Ctrl K'}</kbd>}
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <div className="search-panel" hidden={!showPanel}>
        {state.error ? (
          <p className="search-empty">{state.error}</p>
        ) : state.results && resultCount === 0 && !state.loading ? (
          <p className="search-empty">
            Nothing matches “{term}”.
          </p>
        ) : null}
        <div id={listboxId} role="listbox" aria-label="Search results">
          {groups.map((group) => {
            const headingId = `${listboxId}-${group.key}`;
            const Icon = group.icon;
            return (
              <div key={group.key} role="group" aria-labelledby={headingId} className="search-group">
                <div id={headingId} className="search-group-label">
                  {group.label}
                </div>
                {group.options.map((option) => (
                  <div
                    key={option.key}
                    id={optionId(option.index)}
                    role="option"
                    aria-selected={active === option.index}
                    className={`search-option${active === option.index ? ' active' : ''}`}
                    // Keep focus in the input so the click doesn't close the panel first
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => active !== option.index && setActive(option.index)}
                    onClick={() => go(option.href)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="search-option-text">
                      <span className="search-option-title">{option.title}</span>
                      {option.detail && <span className="search-option-detail">{option.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
