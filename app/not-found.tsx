export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
        <p className="mt-2 text-gray-600">The page you're looking for doesn't exist.</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Go back home
        </a>
      </div>
    </div>
  );
}
