import { useState } from 'react';
import useItems from '../hooks/useItems.js';
import { createItem } from '../services/api.js';

export default function Home() {
  const { items, loading, error, reload } = useItems();
  const [name, setName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    await createItem({ name: name.trim() });
    setName('');
    reload();
  }

  return (
    <section>
      <h1>Items</h1>

      <form onSubmit={handleSubmit} className="form">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New item name"
        />
        <button type="submit">Add</button>
      </form>

      {loading && <p>Loading…</p>}
      {error && <p className="error">Could not reach the API: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No items yet.</p>}

      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </section>
  );
}
