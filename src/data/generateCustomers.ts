import type { Customer } from '../types';
import { AREAS_BY_CITY, FIRST_NAMES, LAST_NAMES } from './constants';
import { createRng, pick } from './seededRandom';

const rng = createRng(0xcafebabe);

const CUSTOMER_COUNT = 2000;

/**
 * Generates a stable customer roster.
 *
 * Design decisions:
 * - Customer type derived from order count (set after orders are generated).
 *   Here we assign a preliminary type; dataService recalculates from real totals.
 * - Names are realistic Indian full names.
 * - Customers are spread across all cities with slight concentration in
 *   large metros (Delhi, Mumbai, Bengaluru).
 */
function generateCustomers(): Customer[] {
  const customers: Customer[] = [];

  // Weight metro cities higher for customer density
  const cityWeights: Record<string, number> = {
    Patna: 5,
    Delhi: 18,
    Mumbai: 17,
    Bengaluru: 16,
    Kolkata: 10,
    Hyderabad: 10,
    Pune: 8,
    Chennai: 7,
    Lucknow: 5,
    Jaipur: 4,
  };
  const cityPool: string[] = [];
  for (const [city, weight] of Object.entries(cityWeights)) {
    for (let w = 0; w < weight; w++) cityPool.push(city);
  }

  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const city = pick(cityPool, rng);
    const area = pick(AREAS_BY_CITY[city], rng);
    const firstName = pick(FIRST_NAMES, rng);
    const lastName = pick(LAST_NAMES, rng);

    customers.push({
      customer_id: `C${String(i + 1).padStart(5, '0')}`,
      customer_name: `${firstName} ${lastName}`,
      city,
      area,
      total_orders: 0,         // populated by dataService
      total_spending: 0,       // populated by dataService
      average_order_value: 0,  // populated by dataService
      customer_type: 'New',    // recalculated by dataService
    });
  }

  return customers;
}

export const customers: Customer[] = generateCustomers();

/** Look-up map for O(1) access by id */
export const customerMap: Map<string, Customer> = new Map(
  customers.map((c) => [c.customer_id, c])
);
