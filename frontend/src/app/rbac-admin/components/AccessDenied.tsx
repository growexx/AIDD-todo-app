export default function AccessDenied() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
      <p className="font-medium">Access denied</p>
      <p className="mt-1 text-sm">You do not have permission to view this section.</p>
    </div>
  );
}
