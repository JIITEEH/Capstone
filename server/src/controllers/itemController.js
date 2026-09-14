import * as Item from '../models/itemModel.js';

export function listItems(req, res) {
  res.json(Item.findAll());
}

export function getItem(req, res) {
  const item = Item.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}

export function createItem(req, res) {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  res.status(201).json(Item.create({ name: name.trim() }));
}

export function deleteItem(req, res) {
  if (!Item.remove(req.params.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.status(204).end();
}
