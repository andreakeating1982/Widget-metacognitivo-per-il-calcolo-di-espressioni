import { cn } from "@/lib/utils";

interface FractionDisplayProps {
  numerator: number | string;
  denominator: number | string;
  numClass?: string;
  denClass?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const sizeMap = {
  xs: "text-sm min-w-[32px]",
  sm: "text-base min-w-[40px]",
  md: "text-xl min-w-[56px]",
  lg: "text-2xl min-w-[72px]",
};

export function FractionDisplay({
  numerator,
  denominator,
  numClass = "",
  denClass = "",
  className,
  size = "md",
}: FractionDisplayProps) {
  // Se il denominatore è 1 (o null/undefined), mostra solo il numeratore (numero intero)
  const den = denominator ?? 1;
  if (den === 1 || den === "1") {
    return (
      <span className={cn("inline-flex items-center align-middle mx-1", sizeMap[size], className)}>
        <span className={cn("block text-center px-1", numClass)}>{numerator}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col items-center align-middle mx-1", sizeMap[size], className)}>
      <span className={cn("block text-center px-1", numClass)}>{numerator}</span>
      <span className="block w-full border-t border-black my-0.5" />
      <span className={cn("block text-center px-1", denClass)}>{denominator}</span>
    </span>
  );
}
