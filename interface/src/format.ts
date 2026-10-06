// The design system's content formats (doc/asset/design-system/README.md,
// Content).
import { formatUnits } from "ethers";

const DATE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

// Amounts are 18-decimal token units: `NZD 48,000.00`. Exact at any size, as
// digits rather than a Number, and truncated to the cent: a fraction of a
// cent is never rounded up into one that does not exist.
export function nzd(amount: bigint | string) {
  const [whole, fraction = ""] = formatUnits(amount, 18).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ",");
  return `NZD ${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

// A block timestamp, in seconds: `14 Oct 2026`, New Zealand time.
export const date = (timestamp: bigint) =>
  DATE.format(new Date(Number(timestamp) * 1000));

// "No unit", "Unit 3", "Units 1 and 2".
export const unitsLabel = (units: bigint[]) =>
  units.length === 0
    ? "No unit"
    : `Unit${units.length > 1 ? "s" : ""} ${new Intl.ListFormat("en-NZ").format(units.map(String))}`;
