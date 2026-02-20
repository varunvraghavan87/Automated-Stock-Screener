// Indian stock market hours utility
// NSE/BSE: Monday-Friday, 9:15 AM - 3:30 PM IST (UTC+5:30)

/**
 * Check if Indian stock market is currently open.
 * Returns true during NSE/BSE trading hours: Mon-Fri, 9:15 AM - 3:30 PM IST.
 */
export function isIndianMarketOpen(): boolean {
  const now = new Date();

  // Convert to IST (UTC+5:30)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market open: 9:15 AM (555 min), close: 3:30 PM (930 min)
  return timeInMinutes >= 555 && timeInMinutes <= 930;
}

/**
 * Get next market open time as a human-readable string.
 * Useful for displaying when the next auto-update will start.
 */
export function getMarketStatus(): {
  isOpen: boolean;
  label: string;
} {
  const open = isIndianMarketOpen();
  if (open) {
    return { isOpen: true, label: "Market Open" };
  }

  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getDay();
  const timeInMinutes = ist.getHours() * 60 + ist.getMinutes();

  if (day >= 1 && day <= 5 && timeInMinutes < 555) {
    return { isOpen: false, label: "Pre-market" };
  }
  if (day >= 1 && day <= 5 && timeInMinutes > 930) {
    return { isOpen: false, label: "Market Closed" };
  }
  return { isOpen: false, label: "Weekend" };
}
