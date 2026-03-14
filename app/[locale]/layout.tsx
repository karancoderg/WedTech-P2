import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "../globals.css";
import { BackgroundDoodles } from "@/components/BackgroundDoodles";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WedSync — Smart RSVP & Guest Management",
  description:
    "WedSync is a smart RSVP and guest management platform built for Indian weddings. Send personalized invitations, collect RSVPs, and manage event-day check-ins — all in one place.",
  keywords: ["wedding", "RSVP", "guest management", "Indian wedding", "wedding planner"],
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClerkProvider>
      <html lang={locale}>
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className={`${inter.variable} ${playfair.variable} font-sans antialiased overflow-x-hidden`}
        >
          <NextIntlClientProvider messages={messages}>
            <BackgroundDoodles />
            {children}
            <Toaster richColors position="bottom-right" />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
