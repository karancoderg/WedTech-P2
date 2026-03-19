"use client";

import Link from 'next/link';
import { Playfair_Display, Inter } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

export default function HomePage() {
  return (
    <div className={`min-h-screen bg-[#FAF8F5] text-[#5C4033] ${inter.className} overflow-x-hidden`}>
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-10 flex flex-col md:flex-row justify-between items-center px-8 md:px-16 py-8 text-white mix-blend-difference font-semibold text-[10px] tracking-[0.2em] uppercase gap-4">
        <div className="flex gap-12">
          <a href="#about" className="hover:opacity-70 transition-opacity">About</a>
          <a href="#services" className="hover:opacity-70 transition-opacity">Features</a>
        </div>
        <div className={`text-3xl tracking-[0.3em] uppercase ${playfair.className} font-light`}>
          WedSync
        </div>
        <div className="flex gap-12">
          <Link href="/sign-in" className="hover:opacity-70 transition-opacity">Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/image.png"
            alt="Wedding Venue"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-[-100px] left-[-10%] w-[120%] h-[200px] bg-[#FAF8F5] rounded-t-[50%] blur-[2px]" />
        </div>

        <div className="relative z-10 text-center text-white px-4 max-w-5xl mx-auto flex flex-col items-center mix-blend-overlay">
          <h1 className={`text-4xl md:text-5xl lg:text-6xl uppercase tracking-widest leading-[1.3] mb-6 drop-shadow-md ${playfair.className}`}>
            Plan Every Detail.<br />Execute Flawlessly.
          </h1>
          <p className="text-[10px] md:text-xs font-medium tracking-[0.3em] uppercase mb-12 drop-shadow-md">
            The all-in-one digital platform built for professional wedding planners.
          </p>
          <Link href="/sign-in" className="bg-white text-[#5C4033] px-12 py-4 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#F2ECE4] transition-all duration-300">
            Start Planning
          </Link>
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
        <div className="mt-24 w-full relative h-[600px] flex justify-center items-center">
          <div className="absolute left-[10%] top-0 z-10 w-64 h-96 p-4 bg-white shadow-xl">
            <img src="https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover" alt="Wedding planning" />
            <div className="absolute -bottom-10 -left-10 size-32 rounded-full border border-[#5C4033] flex items-center justify-center p-2 bg-[#FAF8F5]">
              <span className="text-[#5C4033] text-center text-[8px] tracking-widest uppercase">Smart<br />Planning<br />Tools</span>
            </div>
          </div>
          {/* Right side heading */}
          <div className="absolute right-[8%] top-[20%] text-right z-20">
            <p className="text-[10px] tracking-[0.3em] font-bold uppercase text-[#8C7A6B] mb-4">For Professionals</p>
            <h3 className={`text-5xl md:text-6xl uppercase tracking-widest leading-tight text-[#5C4033] ${playfair.className}`}>
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
            <div className="group relative overflow-hidden rounded-t-full h-[450px] shadow-lg border-4 border-white/50">
              <img src="/guest-management.jpg" alt="Guest Management" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Guest Management</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Add, group, and track every guest with ease.</p>
              </div>
            </div>

            <div className="relative h-[450px] rounded-t-full overflow-hidden shadow-lg bg-[#5C4033] border-4 border-white/50 flex flex-col items-center justify-center p-12 text-center text-white">
              <span className="material-symbols-outlined text-4xl mb-6 opacity-80">mark_email_read</span>
              <h4 className={`text-2xl tracking-widest uppercase mb-6 ${playfair.className}`}>Digital Invitations & RSVPs</h4>
              <p className="text-[11px] leading-relaxed tracking-wider mb-8 opacity-80">
                Send beautifully crafted digital invitations and track every RSVP response in real-time from your dashboard.
              </p>
              <Link href="/sign-in" className="border border-white/40 px-8 py-3 text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-white hover:text-[#5C4033] transition-colors">
                Get Started
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-t-full h-[450px] shadow-lg border-4 border-white/50">
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" alt="Analytics" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Live Analytics</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Monitor RSVPs, dietary needs, seating & attendance in real-time.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="group relative overflow-hidden rounded-t-full h-[450px] shadow-lg border-4 border-white/50">
              <img src="/seating-plan.jpg" alt="Seating Plan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              {/* White circle to cover watermark */}
              <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors duration-500" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <h4 className={`text-white text-2xl tracking-widest uppercase ${playfair.className}`}>Seating Plans</h4>
                <p className="text-white/70 text-[10px] tracking-wider mt-3">Drag-and-drop seating arrangements with smart table grouping.</p>
              </div>
            </div>

            <div className="relative h-[450px] rounded-t-full overflow-hidden shadow-lg bg-[#8C7A6B] border-4 border-white/50 flex flex-col items-center justify-center p-12 text-center text-white">
              <span className="material-symbols-outlined text-4xl mb-6 opacity-80">description</span>
              <h4 className={`text-2xl tracking-widest uppercase mb-6 ${playfair.className}`}>Vendor Briefings</h4>
              <p className="text-[11px] leading-relaxed tracking-wider opacity-80">
                Instantly auto-generate professional PDF briefings for all your vendors — caterers, photographers, and more.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-t-full h-[450px] shadow-lg border-4 border-white/50">
              <img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop" alt="Check-in" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
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
      <section className="py-32 relative">
        <div className="absolute left-0 top-0 w-1/3 h-full bg-[#EBE3D5]" />
        <div className="relative max-w-6xl mx-auto px-6 h-[500px]">
          <div className="absolute top-0 right-[20%] w-[300px] h-[400px] shadow-2xl z-20">
            <img src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover" alt="Wedding Details" />
          </div>
          <div className="absolute top-16 left-[10%] text-[#5C4033] z-30 max-w-[280px]">
            <p className="text-[10px] tracking-[0.3em] font-bold uppercase mb-4 text-[#8C7A6B]">Why WedSync</p>
            <h3 className={`text-5xl uppercase tracking-widest leading-tight ${playfair.className}`}>Built for<br />Planners</h3>
            <p className="mt-6 text-[11px] text-[#8C7A6B] leading-loose tracking-wide">
              WedSync is the only platform designed exclusively for professional wedding planners. Every feature is crafted to reduce stress and multiply efficiency on your most important days.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 px-6 bg-[#FAF8F5]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 text-center md:text-right">
            <p className="text-[9px] uppercase tracking-widest text-[#8C7A6B] mb-2 font-bold">Priya Sharma — Senior Wedding Planner</p>
            <p className="text-[9px] uppercase tracking-widest text-[#5C4033] font-bold mb-8">300+ Guests Managed</p>
            <h3 className={`text-2xl leading-relaxed text-[#5C4033] ${playfair.className}`}>
              "WedSync transformed the way I run my events. The RSVP tracking alone saved me hours, and the vendor briefing generator is a game-changer. I won't plan a wedding without it."
            </h3>
          </div>
          <div className="flex-1 h-[500px] w-full border-[12px] border-white shadow-xl">
            <img src="https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80" alt="Happy Planner" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF8F5] pt-24 pb-8 px-8 border-t border-[#EBE3D5]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-24">
            <div className="flex w-full justify-center max-w-sm">
              <input type="email" placeholder="ENTER YOUR EMAIL ADDRESS..." className="w-full border-b border-[#CBA88A] bg-transparent pb-3 text-[9px] tracking-[0.2em] outline-none text-[#5C4033] placeholder-[#CBA88A]" />
              <button className="bg-[#5C4033] text-white px-8 py-3 text-[9px] tracking-[0.2em] font-bold hover:bg-[#4A3228] transition-colors ml-4 uppercase">Submit</button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-end pb-8 border-b border-[#EBE3D5]">
            <h3 className={`text-3xl md:text-5xl uppercase text-[#5C4033] leading-tight max-w-2xl ${playfair.className}`}>
              The platform that makes every wedding seamless.
            </h3>
            <div className="flex gap-16 text-[9px] tracking-[0.2em] font-bold uppercase text-[#5C4033] mt-12 md:mt-0">
              <div className="flex flex-col gap-4">
                <span className="text-[#8C7A6B] mb-2">Platform</span>
                <a href="#about" className="hover:text-[#8C7A6B]">About</a>
                <a href="#services" className="hover:text-[#8C7A6B]">Features</a>
                <Link href="/sign-in" className="hover:text-[#8C7A6B]">Sign In</Link>
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
