/**
 * Unit tests for calibration reminder helpers (no DB).
 */

const { recomputeNextDue, parseTaskData } = require('../../services/calibrationReminders');

describe('calibrationReminders helpers', () => {
    describe('recomputeNextDue', () => {
        it('returns ISO date string interval days after last calibration', () => {
            const next = recomputeNextDue('2025-06-01', 180);
            expect(next).toBe('2025-11-28');
        });

        it('returns null when interval missing', () => {
            expect(recomputeNextDue('2025-01-01', null)).toBeNull();
        });

        it('returns null when last date missing', () => {
            expect(recomputeNextDue(null, 30)).toBeNull();
        });
    });

    describe('parseTaskData', () => {
        it('parses JSON string', () => {
            expect(parseTaskData('{"a":1}')).toEqual({ a: 1 });
        });

        it('returns object as-is', () => {
            expect(parseTaskData({ x: 2 })).toEqual({ x: 2 });
        });

        it('returns empty object for invalid JSON string', () => {
            expect(parseTaskData('not json')).toEqual({});
        });
    });
});
