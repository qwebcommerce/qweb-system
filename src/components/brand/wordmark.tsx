import { cn } from "@/lib/utils";

const lightLogo = "/brand/logo-on-light.png";
const darkLogo = "/brand/logo-on-dark.png";
const mark = "/brand/mark.png";

export function Wordmark({
  className,
  variant = "default",
  markOnly = false,
}: {
  className?: string;
  variant?: "default" | "on-dark" | "on-maroon";
  markOnly?: boolean;
}) {
  const size = cn("h-8 w-auto", className);

  if (markOnly) {
    return <img src={mark} alt="Qweb" className={size} />;
  }

  if (variant === "on-maroon" || variant === "on-dark") {
    return <img src={darkLogo} alt="Qweb" className={size} />;
  }

  return (
    <span className="inline-flex items-center">
      <img src={lightLogo} alt="Qweb" className={cn(size, "dark:hidden")} />
      <img src={darkLogo} alt="" className={cn(size, "hidden dark:block")} />
    </span>
  );
}
