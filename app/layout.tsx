import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Replai",
  description: "WhatsApp AI customer support platform for South African businesses",
  icons: {
    icon: "/replai_favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}
      {/* <iframe
        src="http://localhost:3000/widget/6662a31eb9fc43469835f88949ec3e85"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "380px",
          height: "580px",
          border: "none",
          zIndex: 9999,
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
        allow="microphone"
      ></iframe> */}
      </body>
    </html>
  );
}
