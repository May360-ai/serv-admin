import { Skeleton } from '@/components/ui/skeleton';

export default function RutasLoading() {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="flex flex-1 gap-4">
        <Skeleton className="w-72 shrink-0 rounded-lg" />
        <div className="flex-1 flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-72 shrink-0 h-96 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
