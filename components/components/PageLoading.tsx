export default function PageLoading({
  title,
}: {
  title?: string;
}) {
  return (
    <div className="space-y-4 animate-pulse">
      {title && (
        <div className="h-8 w-1/2 bg-slate-200 rounded" />
      )}
      <div className="h-20 bg-slate-100 rounded-2xl" />
      <div className="h-20 bg-slate-100 rounded-2xl" />
      <div className="h-20 bg-slate-100 rounded-2xl" />
    </div>
  );
}