import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-wedding-gold">
            WedSync
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your planner account
          </p>
        </div>

        {/* Clerk Sign-Up */}
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-md rounded-2xl border border-stone-200",
              headerTitle: "text-stone-800 font-semibold",
              headerSubtitle: "text-stone-500",
              socialButtonsBlockButton:
                "border border-stone-300 hover:bg-stone-50",
              formButtonPrimary:
                "bg-wedding-gold hover:bg-wedding-gold-light text-white",
              footerActionLink: "text-wedding-gold hover:text-wedding-gold-light",
            },
          }}
        />

        {/* Footer */}
        <p className="text-center text-xs text-stone-400">
          WedSync — Built for Indian Weddings
        </p>
      </div>
    </div>
  );
}
