/// Tiny className-joiner (falsy values dropped) — deliberately not the `clsx`/`tailwind-merge`
/// pair to avoid two extra dependencies for something this small at F01. Revisit if a later
/// phase's conditional-class complexity genuinely needs conflict-resolving merge behavior.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
