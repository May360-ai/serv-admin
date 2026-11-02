import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="flex h-full rounded-lg border border-border overflow-hidden">
      <div className="w-72 shrink-0 border-r border-border p-4 space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    </div>
  );
}
