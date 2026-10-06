// shadcn/ui's class-name helper: joins classes, and a later Tailwind class
// wins over an earlier one that sets the same property.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
