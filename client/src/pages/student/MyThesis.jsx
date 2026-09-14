import ThesisForm from '../../components/thesis/ThesisForm.jsx';
import { LoadState } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import ThesisDetail from '../ThesisDetail.jsx';

export default function MyThesis() {
  const { data: theses, loading, error, reload } = useApi(() => api.listTheses(), []);

  if (!theses) return <LoadState loading={loading} error={error} />;
  if (theses.length) return <ThesisDetail thesisId={theses[0].id} />;

  return (
    <>
      <PageHeader
        title="Start your thesis"
        subtitle="Add the basic details now. You can edit them until your thesis is completed."
      />
      <section className="card form-card">
        <ThesisForm
          submitLabel="Create thesis"
          onSubmit={async (values) => {
            await api.createThesis(values);
            await reload();
          }}
        />
      </section>
    </>
  );
}
