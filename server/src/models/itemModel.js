import db from '../db/index.js';

export function findAll() {
  return db.prepare('SELECT * FROM items ORDER BY id DESC').all();
}

export function findById(id) {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

export function create({ name }) {
  const result = db.prepare('INSERT INTO items (name) VALUES (?)').run(name);
  return findById(result.lastInsertRowid);
}

export function remove(id) {
  return db.prepare('DELETE FROM items WHERE id = ?').run(id).changes > 0;
}
