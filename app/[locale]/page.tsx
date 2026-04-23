"use client";

import { Link } from "@/i18n/routing";
import { Playfair_Display, Inter } from 'next/font/google';
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const playfair = Playfair_Display({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const toastShown = useRef(false);

  // Show auth-required toast when redirected from a protected route
  useEffect(() => {
    if (searchParams.get('auth') === 'required' && !toastShown.current) {
      toastShown.current = true;
      toast.error("Please log in or create an account to access that page.", {
        duration: 6000,
        action: {
          label: "Sign In",
          onClick: () => {
            window.location.href = "/sign-in";
          },
        },
      });
      // Clean up the URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [searchParams]);

  return (
    <div className={`min-h-screen bg-[#FAF8F5] text-[#5C4033] ${inter.className} overflow-x-hidden`}>
      <nav className="absolute top-0 w-full z-10 flex flex-col md:flex-row justify-between items-center px-4 md:px-16 py-6 md:py-8 text-white font-bold text-[9px] md:text-[10px] tracking-[0.2em] uppercase gap-4 md:gap-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        <div className="flex gap-6 md:gap-12 order-2 md:order-1">
          <a href="#about" className="hover:opacity-70 transition-opacity">About</a>
          <a href="#services" className="hover:opacity-70 transition-opacity">Features</a>
        </div>
        <div className={`text-2xl md:text-3xl tracking-[0.3em] uppercase ${playfair.className} font-light order-1 md:order-2 mb-2 md:mb-0`}>
          WedSync
        </div>
        <div className="flex gap-6 md:gap-12 order-3">
          {isSignedIn ? (
            <Link href="/dashboard" className="hover:opacity-70 transition-opacity">Dashboard</Link>
          ) : (
            <Link href="/sign-in" className="hover:opacity-70 transition-opacity">Login</Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[500px] w-full flex flex-col items-center justify-center pt-28 md:pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/image.png"
            alt="Wedding Venue"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#5C4033]/20 mix-blend-color-burn" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-[-100px] lg:bottom-[-150px] left-[-10%] w-[120%] h-[200px] bg-[#FAF8F5] rounded-t-[50%] blur-[2px]" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center">
          <h1 className={`text-4xl md:text-5xl lg:text-7xl text-white uppercase tracking-widest leading-[1.3] mb-6 drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)] ${playfair.className}`}>
            Plan Every Detail.<br />Execute Flawlessly.
          </h1>
          <p className="text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase mb-12 text-white/90 bg-black/40 px-6 py-2 rounded-full backdrop-blur-md shadow-2xl border border-white/20">
            The all-in-one digital platform built for professional wedding planners.
          </p>
          {isSignedIn ? (
            <Link href="/dashboard" className="bg-white text-[#5C4033] px-12 py-4 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#F2ECE4] hover:scale-105 transition-all duration-300 shadow-2xl">
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/sign-in" className="bg-white text-[#5C4033] px-12 py-4 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#F2ECE4] hover:scale-105 transition-all duration-300 shadow-2xl">
              Start Planning
            </Link>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 max-w-6xl mx-auto flex flex-col items-center text-center">

        <h2 className={`text-2xl md:text-3xl leading-relaxed text-[#5C4033] max-w-4xl tracking-wider uppercase ${playfair.className}`}>
          The smartest way to manage your weddings — guests, RSVPs, seating, and more, all in one place.
        </h2>

        <div className="flex flex-col md:flex-row gap-12 mt-16 text-left text-[11px] font-medium tracking-wide text-[#8C7A6B] leading-loose max-w-4xl">
          <p className="flex-1">
            WedSync is purpose-built for professional wedding planners who need to stay on top of every detail. From managing hundreds of guests to tracking RSVPs in real-time, WedSync gives you the clarity and confidence to deliver a perfect event every time.
          </p>
          <p className="flex-1">
            Send elegant digital invitations, instantly generate vendor briefings, and seat your guests with precision using our intelligent seating plan tool. Everything you need — beautifully organised, at your fingertips, on any device.
          </p>
        </div>

        {/* Intro Image Layout */}
        <div className="mt-16 md:mt-24 w-full relative h-auto md:h-[600px] flex flex-col md:flex-row justify-center items-center gap-16 md:gap-0">
          <div className="md:absolute md:left-[10%] md:top-0 z-10 w-64 h-96 p-4 bg-white shadow-xl relative order-2 md:order-1 mt-8 md:mt-0 mx-auto">
            <img src="/about-wedding-planning.jpg" className="w-full h-full object-cover" alt="Wedding planning" />
            <div className="absolute -bottom-6 -left-6 md:-bottom-10 md:-left-10 size-24 md:size-32 rounded-full border border-[#5C4033] flex items-center justify-center p-2 bg-[#FAF8F5]">
              <span className="text-[#5C4033] text-center text-[7px] md:text-[8px] tracking-widest uppercase">Smart<br />Planning<br />Tools</span>
            </div>
          </div>
          {/* Right side heading */}
          <div className="md:absolute md:right-[8%] md:top-[20%] text-center md:text-right z-20 order-1 md:order-2">
            <p className="text-[9px] md:text-[10px] tracking-[0.3em] font-bold uppercase text-[#8C7A6B] mb-4">For Professionals</p>
            <h3 className={`text-4xl md:text-6xl uppercase tracking-widest leading-tight text-[#5C4033] ${playfair.className}`}>
              Every<br />Detail.<br />Perfected.
            </h3>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section id="services" className="py-24 px-6 bg-[#F2ECE4]">
        <div className="max-w-6xl mx-auto">
          <h3 className={`text-center text-3xl tracking-widest uppercase text-[#5C4033] mb-20 ${playfair.className}`}>
            Our Features
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group relative overflow-hidden rounded-t-full h-[320px] lg:h-[450px] shadow-lg border-4 border-white/50">
              <img src="/guest-management.jpg" alt="Guest Management" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Guest Management</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Add, group, and track every guest with ease.</p>
              </div>
            </div>

            <div className="relative h-[320px] lg:h-[450px] rounded-t-full overflow-hidden shadow-lg bg-[#5C4033] border-4 border-white/50 flex flex-col items-center justify-center p-12 text-center text-white">
              <span className="material-symbols-outlined text-4xl mb-6 opacity-80">mark_email_read</span>
              <h4 className={`text-2xl tracking-widest uppercase mb-6 ${playfair.className}`}>Digital Invitations & RSVPs</h4>
              <p className="text-[11px] leading-relaxed tracking-wider mb-8 opacity-80">
                Send beautifully crafted digital invitations and track every RSVP response in real-time from your dashboard.
              </p>
              {isSignedIn ? (
                <Link href="/dashboard" className="border border-white/40 px-8 py-3 text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-white hover:text-[#5C4033] transition-colors">
                  Go to Dashboard
                </Link>
              ) : (
                <Link href="/sign-in" className="border border-white/40 px-8 py-3 text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-white hover:text-[#5C4033] transition-colors">
                  Get Started
                </Link>
              )}
            </div>

            <div className="group relative overflow-hidden rounded-t-full h-[320px] lg:h-[450px] shadow-lg border-4 border-white/50">
              <img src="/analytics-dashboard.jpg" alt="Analytics" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Live Analytics</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Monitor RSVPs, dietary needs, seating & attendance in real-time.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="group relative overflow-hidden rounded-t-full h-[320px] lg:h-[450px] shadow-lg border-4 border-white/50">
              <img src="/seating-plan.jpg" alt="Seating Plan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              {/* White circle to cover watermark */}
              <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Seating Plans</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Drag-and-drop seating arrangements with smart table grouping.</p>
              </div>
            </div>

            <div className="relative h-[320px] lg:h-[450px] rounded-t-full overflow-hidden shadow-lg bg-[#8C7A6B] border-4 border-white/50 flex flex-col items-center justify-center p-12 text-center text-white">
              <span className="material-symbols-outlined text-4xl mb-6 opacity-80">description</span>
              <h4 className={`text-2xl tracking-widest uppercase mb-6 ${playfair.className}`}>Vendor Briefings</h4>
              <p className="text-[11px] leading-relaxed tracking-wider opacity-80">
                Instantly auto-generate professional PDF briefings for all your vendors — caterers, photographers, and more.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-t-full h-[320px] lg:h-[450px] shadow-lg border-4 border-white/50">
              <img src="/checkin-ceremony.jpg" alt="Check-in" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Day-of Check-In</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Streamlined on-the-day guest check-in to keep everything flowing smoothly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why WedSync Section */}
      <section className="py-20 md:py-32 relative">
        <div className="absolute left-0 top-0 w-full md:w-1/3 h-full bg-[#EBE3D5] opacity-50 md:opacity-100" />
        <div className="relative max-w-6xl mx-auto px-6 h-auto md:h-[500px] flex flex-col md:block items-center text-center md:text-left gap-12">
          <div className="md:absolute md:top-0 md:right-[20%] w-[260px] md:w-[300px] h-[340px] md:h-[400px] shadow-2xl z-20 border-8 md:border-[12px] border-white order-1 md:order-2 mx-auto">
            <img src="/why-wedsync.jpg" className="w-full h-full object-cover" alt="Wedding Details" />
          </div>
          <div className="md:absolute md:top-16 md:left-[10%] text-[#5C4033] z-30 max-w-[320px] md:max-w-[280px] order-2 md:order-1">
            <p className="text-[10px] tracking-[0.3em] font-bold uppercase mb-4 text-[#8C7A6B]">Why WedSync</p>
            <h3 className={`text-4xl md:text-5xl uppercase tracking-widest leading-tight ${playfair.className}`}>Built for<br />Planners</h3>
            <p className="mt-6 text-[11px] text-[#8C7A6B] leading-loose tracking-wide">
              WedSync is the only platform designed exclusively for professional wedding planners. Every feature is crafted to reduce stress and multiply efficiency on your most important days.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 px-6 bg-[#FAF8F5] relative z-20">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-16 relative">
          <div className="flex-1 text-center md:text-right relative z-10">
            <p className="text-[9px] uppercase tracking-widest text-[#8C7A6B] mb-2 font-bold">Priya Sharma — Senior Wedding Planner</p>
            <p className="text-[9px] uppercase tracking-widest text-[#5C4033] font-bold mb-8">300+ Guests Managed</p>
            <h3 className={`text-2xl leading-relaxed text-[#5C4033] relative ${playfair.className}`}>
              "WedSync transformed the way I run my events. The RSVP tracking alone saved me hours, and the vendor briefing generator is a game-changer. I won't plan a wedding without it."
            </h3>
          </div>
          <div className="flex-1 h-[320px] md:h-[500px] w-full max-w-[320px] md:max-w-none mx-auto border-8 md:border-[12px] border-white shadow-xl relative z-20 order-1 md:order-2">
            <img src="/testimonial-planner.jpg" alt="Happy Planner" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF8F5] pt-24 pb-8 px-8 border-t border-[#EBE3D5]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-24">
            <h4 className={`text-xl md:text-2xl uppercase tracking-[0.3em] text-[#5C4033] mb-8 ${playfair.className}`}>
              Subscribe to our Newsletter
            </h4>
            <div className="flex w-full justify-center max-w-sm">
              <input suppressHydrationWarning type="email" placeholder="ENTER YOUR EMAIL ADDRESS..." className="w-full border-b border-[#CBA88A] bg-transparent pb-3 text-[9px] tracking-[0.2em] outline-none text-[#5C4033] placeholder-[#CBA88A]" />
              <button suppressHydrationWarning className="bg-[#5C4033] text-white px-8 py-3 text-[9px] tracking-[0.2em] font-bold hover:bg-[#4A3228] transition-colors ml-4 uppercase">Submit</button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center md:items-end pb-8 border-b border-[#EBE3D5] text-center md:text-left gap-8">
            <h3 className={`text-2xl md:text-5xl uppercase text-[#5C4033] leading-tight max-w-2xl ${playfair.className}`}>
              The platform that makes every wedding seamless.
            </h3>
            <div className="flex flex-wrap justify-center md:justify-end gap-8 md:gap-16 text-[9px] tracking-[0.2em] font-bold uppercase text-[#5C4033] mt-4 md:mt-0">
              <div className="flex flex-col gap-4">
                <span className="text-[#8C7A6B] mb-2">Platform</span>
                <a href="#about" className="hover:text-[#8C7A6B]">About</a>
                <a href="#services" className="hover:text-[#8C7A6B]">Features</a>
                {isSignedIn ? (
                  <Link href="/dashboard" className="hover:text-[#8C7A6B]">Dashboard</Link>
                ) : (
                  <Link href="/sign-in" className="hover:text-[#8C7A6B]">Sign In</Link>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-[#8C7A6B] mb-2">Features</span>
                <a href="#services" className="hover:text-[#8C7A6B]">Guest Management</a>
                <a href="#services" className="hover:text-[#8C7A6B]">RSVP Tracking</a>
                <a href="#services" className="hover:text-[#8C7A6B]">Seating Plans</a>
                <a href="#services" className="hover:text-[#8C7A6B]">Vendor Briefings</a>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-[#8C7A6B] mb-2">Contact</span>
                <span className="cursor-text">info@wedsync.com</span>
                <span className="cursor-text">+1 (555) 123-4567</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 text-[#8C7A6B] text-[8px] tracking-[0.2em] uppercase font-bold">
            <p>© WedSync All Rights Reserved</p>
            <div className="flex gap-4">
              <Link href="#">Privacy Policy</Link>
              <Link href="#">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
