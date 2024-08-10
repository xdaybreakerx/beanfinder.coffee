import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import preact from "@astrojs/preact";
import netlify from "@astrojs/netlify";

// Determine if we're in a production environment
const isProduction = process.env.NODE_ENV === 'production';

// Use different site URLs based on the environment
const siteUrl = isProduction
  ? 'https://www.beanfinder.coffee'  // Production site URL
  : 'http://localhost:4321';         // Local development URL

export default defineConfig({
  site: siteUrl,                      // Use the dynamically selected site URL
  integrations: [tailwind(), sitemap(), react(), preact()],
  output: "server",
  adapter: netlify()
});
