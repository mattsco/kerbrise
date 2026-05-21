"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

export default function HomePage() {
  const { scrollY } = useScroll();

  // Parallax léger
  const y = useTransform(scrollY, [0, 500], [0, 80]);

  return (
    <main className="min-h-screen relative overflow-hidden bg-black">
      {/* Background sunset */}
      <motion.img
        style={{ y }}
        src="/sunset.jpg"
        alt="Kerbrise au coucher du soleil"
        className="absolute inset-0 w-full h-full object-cover scale-105 animate-[slowZoom_20s_ease-in-out_infinite_alternate]"
      />

      {/* Halos lumineux */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-orange-300/20 blur-3xl rounded-full animate-float" />
        <div className="absolute bottom-[-20%] right-[0%] w-[400px] h-[400px] bg-pink-300/10 blur-3xl rounded-full animate-floatSlow" />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60" />

      {/* Grain cinéma */}
      <div className="noise absolute inset-0 pointer-events-none" />

      {/* Contenu */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="relative z-10 min-h-screen flex flex-col"
      >
        {/* Localisation */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pt-12">
          Saint-Malo · Rothéneuf
        </p>

        {/* Bloc central */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="text-6xl sm:text-7xl font-light text-white tracking-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
          >
            Kerbrise
          </motion.h1>

          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 64, opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="h-px bg-white/50 my-5"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 1 }}
          >
            <Link
              href="/login"
              className="inline-block px-10 py-3 rounded-full border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm transition"
            >
              Se connecter
            </Link>
          </motion.div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pb-20">
          Antoine · François · Vincent
        </p>
      </motion.div>

      {/* Animations */}
      <style jsx>{`
        @keyframes slowZoom {
          from {
            transform: scale(1.05);
          }
          to {
            transform: scale(1.12);
          }
        }

        @keyframes float {
          0% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
          100% {
            transform: translateY(0px) translateX(0px);
          }
        }

        @keyframes floatSlow {
          0% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(15px) translateX(-15px);
          }
          100% {
            transform: translateY(0px) translateX(0px);
          }
        }

        @keyframes noiseMove {
          0% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-1%, 1%);
          }
          50% {
            transform: translate(1%, -1%);
          }
          75% {
            transform: translate(1%, 1%);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        .animate-float {
          animation: float 12s ease-in-out infinite;
        }

        .animate-floatSlow {
          animation: floatSlow 18s ease-in-out infinite;
        }

        .noise {
          opacity: 0.05;
          background-image: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
          animation: noiseMove 0.4s steps(2) infinite;
          mix-blend-mode: soft-light;
        }
      `}</style>
    </main>
  );
}