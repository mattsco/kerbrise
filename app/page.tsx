import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-black">
      {/* Background sunset */}
      <img
        src="/sunset.jpg"
        alt="Kerbrise au coucher du soleil"
        className="absolute inset-0 w-full h-full object-cover scale-105 animate-[slowZoom_20s_ease-in-out_infinite_alternate]"
      />

      {/* Halos lumineux */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-orange-300/20 blur-3xl rounded-full animate-[float_12s_ease-in-out_infinite]" />

        <div className="absolute bottom-[-20%] right-[0%] w-[400px] h-[400px] bg-pink-300/10 blur-3xl rounded-full animate-[floatSlow_18s_ease-in-out_infinite]" />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60" />

      {/* Grain cinéma */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-soft-light animate-[noiseMove_0.4s_steps(2)_infinite]"
        style={{
          backgroundImage:
            'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")',
        }}
      />

      {/* Contenu */}
      <div className="relative z-10 min-h-screen flex flex-col animate-[fadeIn_1.2s_ease-out]">
        {/* Localisation */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pt-12">
          Saint-Malo · Rothéneuf
        </p>

        {/* Bloc central */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <h1 className="text-6xl sm:text-7xl font-light text-white tracking-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.55)] animate-[titleAppear_1.4s_ease-out]">
            Kerbrise
          </h1>

          <div className="w-16 h-px bg-white/50 my-5 animate-[lineAppear_1s_ease-out]" />

          <Link
            href="/login"
            className="inline-block px-10 py-3 rounded-full border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm transition hover:scale-[1.03] active:scale-[0.98]"
          >
            Se connecter
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pb-20">
          Antoine · François · Vincent
        </p>
      </div>

      {/* Keyframes globaux */}
      <style>{`
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes titleAppear {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes lineAppear {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 4rem;
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
} 