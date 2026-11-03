import { Skeleton } from "@/components/ui/skeleton";

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="hidden w-[17rem] border-e border-[#550000]/35 bg-[#0c0505] p-5 lg:block">
        <Skeleton className="mb-6 h-8 w-32 bg-white/10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full bg-white/10" />
          <Skeleton className="h-8 w-full bg-white/10" />
          <Skeleton className="h-8 w-full bg-white/10" />
          <Skeleton className="h-8 w-4/5 bg-white/10" />
        </div>
      </div>
      <div className="flex-1">
        <div className="h-0.5 bg-[#550000]" />
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
