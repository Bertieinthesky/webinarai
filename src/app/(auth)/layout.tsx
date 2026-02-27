/**
 * (auth)/layout.tsx — Layout for authentication pages (login, signup)
 *
 * PURPOSE:
 *   Centers the auth form card in the viewport with a dark background.
 *   Clean, focused auth experience with subtle branding.
 */

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">{children}</div>
    </div>
  );
}
