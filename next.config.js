/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Sert AVIF en priorité (le plus léger), puis WebP, puis fallback au format
    // d'origine. next/image négocie le format selon le navigateur du visiteur.
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
