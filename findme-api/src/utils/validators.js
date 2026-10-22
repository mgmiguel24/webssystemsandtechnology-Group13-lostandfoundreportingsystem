// Rules for every piece of data the API accepts. The server never trusts the browser.
const { z } = require('zod');

const TYPES = ['Lost', 'Found'];
const CATEGORIES = ['Person', 'Pet', 'Item'];
const STATUSES = ['Active', 'Resolved'];
const ROLES = ['user', 'admin'];

const oneOf = (list, label) =>
  z.string().refine((v) => list.includes(v), `${label} must be one of: ${list.join(', ')}`);

// Empty query strings ("") from the filter dropdowns mean "no filter".
const optionalFilter = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const text = (label, min, max) =>
  z.string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the server's time zone
}

const isoDate = z
  .string({ error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use the YYYY-MM-DD format')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Date is not a real calendar date');

const email = z.string({ error: 'Email is required' }).trim().toLowerCase().max(254).email('Enter a valid email address');

module.exports = {
  register: z.object({
    name: text('Name', 2, 80),
    email,
    password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(128),
  }),

  login: z.object({
    email,
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
  }),

  createReport: z.object({
    type: oneOf(TYPES, 'Report type'),
    category: oneOf(CATEGORIES, 'Category'),
    title: text('Title', 3, 120),
    location: text('Location', 2, 120),
    // One day of tolerance so a user in a time zone ahead of the server is not rejected.
    date: isoDate.refine((s) => s <= localDate(1), 'Date cannot be in the future'),
    description: text('Description', 10, 2000),
    contact: text('Contact information', 5, 120),
  }),

  updateReport: z.object({
    title: text('Title', 3, 120),
    location: text('Location', 2, 120),
    date: isoDate.refine((s) => s <= localDate(1), 'Date cannot be in the future'),
    description: text('Description', 10, 2000),
    contact: text('Contact information', 5, 120),
  }).partial(),

  listQuery: z.object({
    q: optionalFilter(z.string().trim().max(100)),
    type: optionalFilter(oneOf(TYPES, 'Type')),
    category: optionalFilter(oneOf(CATEGORIES, 'Category')),
    status: optionalFilter(oneOf(STATUSES, 'Status')),
    date: optionalFilter(isoDate),
    dateFrom: optionalFilter(isoDate),
    dateTo: optionalFilter(isoDate),
    page: optionalFilter(z.coerce.number().int().min(1)).transform((v) => v ?? 1),
    limit: optionalFilter(z.coerce.number().int().min(1).max(100)).transform((v) => v ?? 50),
  }),

  status: z.object({ status: oneOf(STATUSES, 'Status') }),
  role: z.object({ role: oneOf(ROLES, 'Role') }),
  id: z.coerce.number({ error: 'Invalid id' }).int('Invalid id').positive('Invalid id'),
};
