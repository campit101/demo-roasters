"use client";

/** Minus, number, plus. The number is announced with its label; buttons stop at 1 and the cap. */
export function QuantityStepper({
  value,
  max,
  onChange,
  label,
  small = false,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  small?: boolean;
}) {
  const size = small ? "h-9 w-9" : "h-12 w-11";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-full border border-line">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="One fewer" className={`${size} grid place-items-center rounded-full disabled:opacity-35 enabled:hover:bg-sand`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
      <output aria-live="polite" className={`${small ? "w-6" : "w-8"} text-center font-semibold tabular-nums`}>
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="One more" className={`${size} grid place-items-center rounded-full disabled:opacity-35 enabled:hover:bg-sand`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
