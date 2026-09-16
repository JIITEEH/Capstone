import { Router } from 'express';
import { search } from '../request-handlers/searchController.js';

const router = Router();

// Every role searches; the queries only return what that role can already open
router.get('/', search);

export default router;
