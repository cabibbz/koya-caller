/**
 * Root Loading State
 * Shows while the app is loading
 */

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {/* Animated logo/spinner */}
        <div className="w-16 h-16 relative mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
        </div>

        {/* Text */}
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
