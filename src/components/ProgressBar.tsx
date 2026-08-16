"use client";

/** Barra de progresso linear estilo Duolingo */
export default function ProgressBar({
  valor,
  total,
  cor = "bg-duo-green",
}: {
  valor: number;
  total: number;
  cor?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div
      className="w-full h-4 rounded-full bg-gray-200 dark:bg-[#37464f] overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full ${cor} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
