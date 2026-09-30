import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { detail, search, trending } from '../controllers/movies.js';
import { getUserMovieState, removeFromWatchlist, setRating, setWatchlistStatus } from '../controllers/userMovies.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
const movieSearchLimit = rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many searches. Take a moment and try again.' } } });

router.get('/trending', trending);
router.get('/search', movieSearchLimit, search);
router.get('/:tmdbId', detail);
router.get('/:tmdbId/me', requireUser, getUserMovieState);
router.put('/:tmdbId/rating', requireUser, setRating);
router.put('/:tmdbId/watchlist', requireUser, setWatchlistStatus);
router.delete('/:tmdbId/watchlist', requireUser, removeFromWatchlist);

export default router;
