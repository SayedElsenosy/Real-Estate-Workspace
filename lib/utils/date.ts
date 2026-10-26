const cairoFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  calendar: "gregory",
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ZONED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

/**
 * Return a Cairo business date as YYYY-MM-DD.
 *
 * PostgreSQL DATE columns are already calendar dates: preserve their value.
 * Instants (Date / offset-aware ISO string) are converted to Africa/Cairo.
 * Reject ambiguous timezone-free timestamps rather than interpreting them
 * differently under Node/Vercel/browser machine timezone settings.
 */
export function businessDate(value: Date | string): string {
  if (typeof value === "string") {
    if (DATE_ONLY.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        year < 100 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day
      ) {
        throw new RangeError("Invalid business calendar date");
      }
      return value;
    }
    if (!ZONED_TIMESTAMP.test(value)) {
      throw new RangeError("Business datetime strings require Z or an explicit UTC offset");
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid business date");
  const parts = cairoFormatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
