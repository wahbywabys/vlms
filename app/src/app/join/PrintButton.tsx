'use client';
export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="button" onClick={() => print()}>{label}</button>;
}
