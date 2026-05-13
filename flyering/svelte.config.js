import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
  },
  kit: {
    // adapter-static for Firebase Hosting
    adapter: adapter({
      pages: "build/stories/flyering",
      assets: "build/stories/flyering",
      fallback: "index.html",
      precompress: false,
      strict: true,
    }),
    paths: {
      base: "/stories/flyering",
    },
    prerender: {
      entries: ["*"],
      handleUnseenRoutes: "ignore",
    },
  },
};

export default config;
