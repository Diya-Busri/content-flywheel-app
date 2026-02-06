export default function SignUpLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="text-sm font-medium text-white">Loading sign up...</p>
      </div>
    </div>
  );
}
