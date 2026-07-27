export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`inline-flex ${size} leading-none`} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "text-star" : "text-hairline"}>
          ★
        </span>
      ))}
    </span>
  );
}
