import { BUSINESS_NAME } from "@/theme/format";

/**
 * Split layout for every sign-in screen (admin login, password reset, rider login):
 * the brand photo on the left, the form on the right. On phones the photo becomes a
 * banner above the form, so the card is never squeezed.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <div className="relative h-52 w-full shrink-0 overflow-hidden sm:h-72 lg:h-auto lg:w-[58%]">
        <img
          src="/login-hero.jpg"
          alt={`${BUSINESS_NAME} — good food, great vibes`}
          // Keep the logo and "Welcome" (left third of the photo) in view when the
          // tall desktop panel crops the wide image.
          className="absolute inset-0 h-full w-full object-cover object-[18%_center]"
        />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
