import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, Download, FileText } from 'lucide-react';
import { EmptyState, LoadState } from '../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import { api } from '../api-client/api.js';
import { formatDate } from '../helpers/format.js';
import { keywordList } from './Archive.jsx';

export default function ArchiveDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: thesis, loading, error, reload } = useApi(() => api.getArchived(id), [id]);
  const [downloading, setDownloading] = useState(false);

  if (!thesis) return <LoadState loading={loading} error={error} onRetry={reload} />;

  async function download() {
    setDownloading(true);
    try {
      await api.downloadArchivedManuscript(thesis.id, `${thesis.title}.pdf`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/archive" className="back-link">
            <ChevronLeft size={16} />
            Thesis archive
          </Link>
        }
        title={thesis.title}
        subtitle={<span className="header-meta">Completed {formatDate(thesis.completed_at)}</span>}
        actions={
          thesis.manuscript_id && (
            <button type="button" className="btn btn-primary" onClick={download} disabled={downloading}>
              <Download size={16} />
              {downloading ? 'Downloading…' : 'Download manuscript'}
            </button>
          )
        }
      />

      <div className="detail-layout">
        <section className="card">
          <div className="card-header">
            <h2>Abstract</h2>
          </div>
          {thesis.abstract ? <p className="prose">{thesis.abstract}</p> : <p className="muted">No abstract was written.</p>}
          {thesis.keywords && (
            <div className="chips">
              {keywordList(thesis.keywords).map((keyword) => (
                <span key={keyword} className="chip">
                  {keyword}
                </span>
              ))}
            </div>
          )}
          {!thesis.manuscript_id && (
            <EmptyState compact icon={FileText} title="No manuscript on file" message="This thesis was completed without an uploaded final manuscript." />
          )}
        </section>

        <aside className="card">
          <div className="card-header">
            <h2>People</h2>
          </div>
          <dl className="archive-facts">
            <dt>Students</dt>
            <dd>{thesis.student_name}</dd>
            {thesis.student_program && (
              <>
                <dt>Program</dt>
                <dd>{thesis.student_program}</dd>
              </>
            )}
            <dt>Adviser</dt>
            <dd>{thesis.adviser_name ?? '—'}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
