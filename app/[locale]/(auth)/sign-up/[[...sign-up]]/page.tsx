import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFCF8] font-sans text-stone-800 selection:bg-stone-200">
      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-serif tracking-widest text-center mx-auto text-stone-800 mb-2">
            WED<span className="italic font-light">SYNC</span>
          </h1>
          <p className="mt-2 text-xs font-light tracking-widest uppercase text-stone-500">
            Create your planner account
          </p>
        </div>

        {/* Clerk Sign-Up */}
        <SignUp
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-2xl rounded-2xl border border-stone-200 bg-white",
              headerTitle: "text-stone-800 font-serif text-2xl tracking-widest uppercase",
              headerSubtitle: "text-stone-500 font-light text-sm",
              socialButtonsBlockButton:
                "border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors",
              formButtonPrimary:
                "bg-stone-800 hover:bg-stone-700 text-white text-xs tracking-widest uppercase py-3 transition-colors",
              footerActionLink: "text-stone-800 hover:text-stone-600 font-bold",
            },
          }}
        />

        {/* Footer */}
        <p className="text-center text-xs text-stone-400 tracking-widest uppercase">
          WedSync — Built for Indian Weddings
        </p>
      </div>
    </div>
  );
}
