import data from "./translations-data.json";
import errors from "./translations-errors.json";
export const catalog: Record<string, { ar: string; en: string }> = {
  ...data,
  ...errors,
};
