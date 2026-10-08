/**
 * Static reference tables — cities, areas, cuisines, names, etc.
 * These are imported by all generators and keep domain knowledge in one place.
 */

// ─── Geography ────────────────────────────────────────────────────────────────

export const CITIES = [
  'Patna',
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Kolkata',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Lucknow',
  'Jaipur',
] as const;

export const AREAS_BY_CITY: Record<string, string[]> = {
  Patna: ['Boring Road', 'Kankarbagh', 'Rajendra Nagar', 'Patliputra', 'Bailey Road', 'Ashiyana', 'Danapur'],
  Delhi: ['Connaught Place', 'Lajpat Nagar', 'Karol Bagh', 'Saket', 'Dwarka', 'Rohini', 'Hauz Khas', 'Janakpuri'],
  Mumbai: ['Bandra', 'Andheri', 'Powai', 'Dadar', 'Juhu', 'Colaba', 'Malad', 'Borivali'],
  Bengaluru: ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Jayanagar', 'Marathahalli', 'Electronic City'],
  Kolkata: ['Park Street', 'Salt Lake', 'New Town', 'Ballygunge', 'Behala', 'Dumdum', 'Howrah'],
  Hyderabad: ['Hitech City', 'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Kondapur', 'Madhapur', 'Secunderabad'],
  Pune: ['Koregaon Park', 'Viman Nagar', 'Hinjewadi', 'Baner', 'Kothrud', 'Wakad', 'Aundh'],
  Chennai: ['T Nagar', 'Adyar', 'Velachery', 'Anna Nagar', 'Porur', 'Tambaram', 'Nungambakkam'],
  Lucknow: ['Hazratganj', 'Gomti Nagar', 'Aliganj', 'Alambagh', 'Indira Nagar', 'Rajajipuram', 'Vikas Nagar'],
  Jaipur: ['Malviya Nagar', 'Vaishali Nagar', 'C Scheme', 'Mansarovar', 'Tonk Road', 'Jagatpura', 'Sanganer'],
};

// ─── Food ─────────────────────────────────────────────────────────────────────

export const FOOD_CATEGORIES = [
  'Biryani',
  'North Indian',
  'South Indian',
  'Chinese',
  'Fast Food',
  'Pizza',
  'Desserts',
  'Beverages',
  'Street Food',
] as const;

/** Base price range per category [min, max] in INR */
export const CATEGORY_PRICE_RANGE: Record<string, [number, number]> = {
  Biryani:      [180, 450],
  'North Indian': [150, 500],
  'South Indian': [80, 320],
  Chinese:      [120, 400],
  'Fast Food':  [80, 280],
  Pizza:        [200, 700],
  Desserts:     [60, 250],
  Beverages:    [40, 180],
  'Street Food':[50, 200],
};

/** Order volume weight per category (higher = more popular) */
export const CATEGORY_POPULARITY: Record<string, number> = {
  Biryani:        18,
  'North Indian': 16,
  'South Indian': 12,
  Chinese:        12,
  'Fast Food':    14,
  Pizza:          10,
  Desserts:        6,
  Beverages:       7,
  'Street Food':   5,
};

// ─── Cuisines ─────────────────────────────────────────────────────────────────

export const CUISINES_BY_CATEGORY: Record<string, string[]> = {
  Biryani:        ['Hyderabadi', 'Lucknowi', 'Kolkata Style', 'Mughlai'],
  'North Indian': ['Mughlai', 'Punjabi', 'Rajasthani', 'UP Style'],
  'South Indian': ['Andhra', 'Tamil', 'Kerala', 'Karnataka'],
  Chinese:        ['Indo-Chinese', 'Cantonese', 'Sichuan'],
  'Fast Food':    ['American', 'Fusion', 'Street Style'],
  Pizza:          ['Italian', 'American', 'Fusion'],
  Desserts:       ['Indian Sweets', 'Bakery', 'Ice Cream'],
  Beverages:      ['Juices', 'Shakes', 'Tea & Coffee'],
  'Street Food':  ['Chaat', 'Mumbai Street', 'Delhi Street', 'South Indian Street'],
};

// ─── Restaurant names by cuisine ─────────────────────────────────────────────

export const RESTAURANT_NAME_PREFIXES = [
  'Royal', 'Paradise', 'Spice', 'Taste', 'Golden', 'Classic', 'Urban',
  'Heritage', 'Fresh', 'Authentic', 'Desi', 'Modern', 'Grand', 'Little',
  'New', 'Star', 'City', 'Metro', 'Street', 'House of',
];

export const RESTAURANT_NAME_SUFFIXES = [
  'Kitchen', 'Bites', 'Flavours', 'Corner', 'Dine', 'Express', 'Hub',
  'Point', 'Treats', 'Garden', 'Palace', 'Hut', 'Zone', 'Delight',
  'Junction', 'Cafe', 'Dhaba', 'Eatery', 'House', 'Spot',
];

// ─── Customer first/last names ────────────────────────────────────────────────

export const FIRST_NAMES = [
  'Aarav', 'Arjun', 'Vivaan', 'Aditya', 'Ananya', 'Priya', 'Rahul', 'Sneha',
  'Vikram', 'Pooja', 'Rohit', 'Kavya', 'Amit', 'Divya', 'Suresh', 'Meera',
  'Rajesh', 'Nisha', 'Karan', 'Ankita', 'Sanjay', 'Deepika', 'Nikhil',
  'Swati', 'Manish', 'Ritu', 'Arun', 'Sunita', 'Vikas', 'Geeta', 'Sachin',
  'Rekha', 'Mohit', 'Shreya', 'Ajay', 'Neha', 'Pankaj', 'Simran', 'Gaurav',
  'Preeti', 'Abhishek', 'Pallavi', 'Tarun', 'Shweta', 'Dinesh', 'Bhavna',
];

export const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Mehta', 'Joshi',
  'Rao', 'Nair', 'Reddy', 'Iyer', 'Pillai', 'Das', 'Ghosh', 'Banerjee',
  'Chatterjee', 'Mukherjee', 'Agarwal', 'Mishra', 'Tiwari', 'Dubey',
  'Yadav', 'Chauhan', 'Thakur', 'Saxena', 'Srivastava', 'Pandey', 'Shukla',
  'Bose', 'Kapoor', 'Malhotra', 'Khanna', 'Sethi', 'Bhatia', 'Kohli',
];

// ─── Time / Calendar ──────────────────────────────────────────────────────────

/**
 * Hourly order volume weights (index = hour 0–23).
 * Peak at lunch (12-13) and dinner (19-21), low overnight.
 */
export const HOURLY_WEIGHTS = [
  0.3, 0.1, 0.1, 0.1, 0.1, 0.2,  // 00–05
  0.4, 0.8, 1.2, 1.5, 1.8, 2.5,  // 06–11
  3.5, 3.2, 2.8, 2.2, 1.8, 2.0,  // 12–17
  2.5, 3.8, 4.0, 3.5, 2.5, 1.0,  // 18–23
];

/** Day-of-week multiplier (0=Sun … 6=Sat) */
export const DOW_MULTIPLIER = [1.3, 0.9, 0.85, 0.9, 1.0, 1.15, 1.35];

// ─── Payment methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash on Delivery',
  'Wallet',
] as const;

export const PAYMENT_WEIGHTS = [40, 20, 15, 15, 10]; // UPI dominant in India

// ─── Order statuses ───────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  'Delivered',
  'Cancelled',
  'Pending',
  'Preparing',
  'Out for Delivery',
] as const;
