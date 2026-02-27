/**
 * utils.ts — Tailwind CSS class name merge utility
 *
 * PURPOSE:
 *   The `cn` function combines class names intelligently, resolving
 *   Tailwind CSS conflicts (e.g., "px-2 px-4" → "px-4"). Used throughout
 *   every shadcn/ui component and custom components.
 *
 * HOW IT WORKS:
 *   1. clsx: Handles conditional classes (strings, arrays, objects)
 *   2. twMerge: Resolves Tailwind conflicts (later classes win)
 *
 * EXAMPLE:
 *   cn("px-2 py-1", isActive && "bg-blue-500", "px-4")
 *   → "py-1 bg-blue-500 px-4" (px-4 wins over px-2)
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
