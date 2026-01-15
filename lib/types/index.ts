// BPERP Type Definitions Index
// Re-export all types from modules

export * from './inventory';
export * from './sales';
export * from './tasks';

// Additional common types for BPERP

// User types
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Sales' | 'Operator' | 'Maintenance' | 'Inspector' | 'Shipping';
}

// Note: Task interface is now exported from './tasks' with full manufacturing support

// Activity log types
export interface ActivityLog {
  id: number;
  description: string;
  timestamp: Date;
  iconType: 'user' | 'box' | 'alert' | 'file' | 'puzzle';
}

// Dashboard statistics types
export interface QuoteStats {
  won: number;
  lost: number;
  sent: number;
  revenue: number;
}

export interface WinRateStats {
  winRate: number;
}

export interface InventoryStats {
  materials: {
    count: number;
    totalValue: number;
    lowStock: number;
  };
  tools: {
    count: number;
    totalValue: number;
    lowStock: number;
  };
  misc: {
    count: number;
    totalValue: number;
    lowStock: number;
  };
  total: {
    count: number;
    totalValue: number;
    lowStock: number;
  };
}
