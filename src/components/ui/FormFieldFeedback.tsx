import { AlertCircle } from "lucide-react";

interface FormFieldFeedbackProps {
  error?: string | null;
  hint?: string;
  id?: string;
}

/**
 * Renders an inline error message or helper hint below an input.
 */
export function FormFieldFeedback({ error, hint, id }: FormFieldFeedbackProps) {
  if (error) {
    return (
      <p id={id} className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium animate-fadeIn">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }
  if (hint) {
    return <p id={id} className="mt-1 text-[11px] text-[#65676B]">{hint}</p>;
  }
  return null;
}

interface FormSummaryAlertProps {
  errors: Record<string, string | undefined>;
  title?: string;
}

/**
 * Renders a prominent banner summarizing all validation errors above the submit button.
 */
export function FormSummaryAlert({ errors, title = "Formulir Belum Lengkap" }: FormSummaryAlertProps) {
  const activeErrors = Object.entries(errors).filter(([_, msg]) => !!msg);
  if (activeErrors.length === 0) return null;

  return (
    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 mb-4 animate-fadeIn">
      <div className="flex items-center gap-2 font-semibold text-xs mb-1.5 text-rose-800">
        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
        <span>{title} ({activeErrors.length} data perlu diperbaiki)</span>
      </div>
      <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-700 ml-1">
        {activeErrors.map(([key, msg]) => (
          <li key={key}>
            <span>{msg}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
