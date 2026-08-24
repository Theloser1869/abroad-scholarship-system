import { type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { FORM_CONTROL_CLASSES } from "./input";

/// F09 UX hardening — the exact same `<textarea className="w-full rounded border ...">`
/// markup was duplicated verbatim across ~28 form dialogs (every reason/notes/description
/// field in the app), each one independently missing a real focus ring (see `Input`'s own
/// F09 fix). One shared component now owns that styling — F09 instruction §7: "Nếu cùng một
/// UX pattern xuất hiện ≥2 lần: prefer shared component."
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FORM_CONTROL_CLASSES, className)} {...props} />;
}
