/**
 * FilterContext — global dashboard filter state (9 dimensions).
 *
 * Consumers:
 *   useFilters()        → read current FilterState
 *   useFilterDispatch() → get action dispatchers
 *   toDashboardFilters()→ convert to DashboardFilters for dataService
 */
import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from 'react';
import type { DashboardFilters } from '../services/dataService';
import { getRawOrders, getRawRestaurants } from '../services/dataService';
import { CITIES, AREAS_BY_CITY, FOOD_CATEGORIES, PAYMENT_METHODS, ORDER_STATUSES } from '../data/constants';

// ─── Derived option lists from real data ─────────────────────────────────────

function deriveFilterOptions() {
  const orders      = getRawOrders();
  const restaurants = getRawRestaurants();
  const dates       = orders.map((o) => o.order_date).sort();

  // All distinct areas across all cities (sorted)
  const allAreas = Array.from(
    new Set(Object.values(AREAS_BY_CITY).flat())
  ).sort();

  // All distinct cuisines from orders
  const allCuisines = Array.from(new Set(orders.map((o) => o.cuisine))).sort();

  // Restaurant options (id → name) sorted by name
  const restaurantOptions = restaurants
    .filter((r) => r.total_orders > 0)
    .sort((a, b) => a.restaurant_name.localeCompare(b.restaurant_name))
    .map((r) => ({ id: r.restaurant_id, name: r.restaurant_name, city: r.city }));

  return {
    minDate:            dates[0]   ?? '2024-01-01',
    maxDate:            dates[dates.length - 1] ?? '2024-12-31',
    cities:             [...CITIES] as string[],
    areas:              allAreas,
    cuisines:           allCuisines,
    categories:         [...FOOD_CATEGORIES] as string[],
    statuses:           [...ORDER_STATUSES]  as string[],
    paymentMethods:     [...PAYMENT_METHODS] as string[],
    restaurants:        restaurantOptions,
    ratingOptions:      [1, 2, 3, 3.5, 4, 4.5] as number[],
  };
}

export const FILTER_OPTIONS = deriveFilterOptions();

// ─── State shape ──────────────────────────────────────────────────────────────

export interface FilterState extends DashboardFilters {
  dateLabel: string;
}

// ─── Action types ─────────────────────────────────────────────────────────────

type FilterAction =
  | { type: 'SET_DATE_RANGE';   from: string; to: string }
  | { type: 'TOGGLE_CITY';      city: string }
  | { type: 'TOGGLE_AREA';      area: string }
  | { type: 'TOGGLE_RESTAURANT'; id: string }
  | { type: 'TOGGLE_CATEGORY';  category: string }
  | { type: 'TOGGLE_CUISINE';   cuisine: string }
  | { type: 'TOGGLE_STATUS';    status: string }
  | { type: 'TOGGLE_PAYMENT';   method: string }
  | { type: 'SET_MIN_RATING';   rating: number | undefined }
  | { type: 'RESET' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(from: string, to: string): string {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const f = new Date(from);
  const t = new Date(to);
  if (f.getFullYear() === t.getFullYear()) {
    if (f.getMonth() === t.getMonth()) return `${M[f.getMonth()]} ${f.getFullYear()}`;
    return `${M[f.getMonth()]} – ${M[t.getMonth()]} ${f.getFullYear()}`;
  }
  return `${M[f.getMonth()]} ${f.getFullYear()} – ${M[t.getMonth()]} ${t.getFullYear()}`;
}

function toggle(arr: string[] | undefined, val: string): string[] | undefined {
  const cur  = arr ?? [];
  const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
  return next.length === 0 ? undefined : next;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: FilterState = {
  dateFrom:  FILTER_OPTIONS.minDate,
  dateTo:    FILTER_OPTIONS.maxDate,
  dateLabel: formatDateLabel(FILTER_OPTIONS.minDate, FILTER_OPTIONS.maxDate),
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_DATE_RANGE':
      return { ...state, dateFrom: action.from, dateTo: action.to,
               dateLabel: formatDateLabel(action.from, action.to) };
    case 'TOGGLE_CITY':
      return { ...state, cities:       toggle(state.cities,       action.city) };
    case 'TOGGLE_AREA':
      return { ...state, areas:        toggle(state.areas,        action.area) };
    case 'TOGGLE_RESTAURANT':
      return { ...state, restaurants:  toggle(state.restaurants,  action.id) };
    case 'TOGGLE_CATEGORY':
      return { ...state, categories:   toggle(state.categories,   action.category) };
    case 'TOGGLE_CUISINE':
      return { ...state, cuisines:     toggle(state.cuisines,     action.cuisine) };
    case 'TOGGLE_STATUS':
      return { ...state, statuses:     toggle(state.statuses,     action.status) };
    case 'TOGGLE_PAYMENT':
      return { ...state, paymentMethods: toggle(state.paymentMethods, action.method) };
    case 'SET_MIN_RATING':
      return { ...state, minRating: action.rating };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FiltersCtx  = createContext<FilterState>(INITIAL_STATE);
const DispatchCtx = createContext<React.Dispatch<FilterAction>>(() => {});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return (
    <FiltersCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        {children}
      </DispatchCtx.Provider>
    </FiltersCtx.Provider>
  );
}

export function useFilters(): FilterState {
  return useContext(FiltersCtx);
}

export function useFilterDispatch() {
  const dispatch = useContext(DispatchCtx);
  return useMemo(() => ({
    setDateRange:     (from: string, to: string) => dispatch({ type: 'SET_DATE_RANGE', from, to }),
    toggleCity:       (city: string)     => dispatch({ type: 'TOGGLE_CITY',       city }),
    toggleArea:       (area: string)     => dispatch({ type: 'TOGGLE_AREA',       area }),
    toggleRestaurant: (id: string)       => dispatch({ type: 'TOGGLE_RESTAURANT', id }),
    toggleCategory:   (category: string) => dispatch({ type: 'TOGGLE_CATEGORY',  category }),
    toggleCuisine:    (cuisine: string)  => dispatch({ type: 'TOGGLE_CUISINE',   cuisine }),
    toggleStatus:     (status: string)   => dispatch({ type: 'TOGGLE_STATUS',    status }),
    togglePayment:    (method: string)   => dispatch({ type: 'TOGGLE_PAYMENT',   method }),
    setMinRating:     (rating: number | undefined) => dispatch({ type: 'SET_MIN_RATING', rating }),
    reset:            ()                 => dispatch({ type: 'RESET' }),
  }), [dispatch]);
}

/** Count active non-date filter dimensions */
export function countActiveFilters(state: FilterState): number {
  return (
    (state.cities?.length         ?? 0) +
    (state.areas?.length          ?? 0) +
    (state.restaurants?.length    ?? 0) +
    (state.categories?.length     ?? 0) +
    (state.cuisines?.length       ?? 0) +
    (state.statuses?.length       ?? 0) +
    (state.paymentMethods?.length ?? 0) +
    (state.minRating !== undefined ? 1  : 0)
  );
}

/** Convert FilterState → DashboardFilters (strips UI-only fields) */
export function toDashboardFilters(state: FilterState): DashboardFilters {
  return {
    dateFrom:       state.dateFrom,
    dateTo:         state.dateTo,
    cities:         state.cities,
    areas:          state.areas,
    restaurants:    state.restaurants,
    categories:     state.categories,
    cuisines:       state.cuisines,
    statuses:       state.statuses,
    paymentMethods: state.paymentMethods,
    minRating:      state.minRating,
  };
}
