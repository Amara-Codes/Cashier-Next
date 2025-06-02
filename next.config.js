/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
    domains: [
      'strapi-production-84e6.up.railway.app', // Aggiungi il tuo hostname Strapi qui
      // Se hai altri domini da cui carichi immagini, aggiungili qui
      // es. 'example.com', 'another-cdn.com'
    ],
  },
}

module.exports = nextConfig
