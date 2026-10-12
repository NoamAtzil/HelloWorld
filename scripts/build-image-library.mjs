// Builds src/lib/image-library.json from the image files in public/library/.
// Runs automatically before `npm run dev` and `npm run build`, so adding a
// picture to the library is just: drop the file in public/library/.
//
// The title comes from the file name: "dinosaur-waiting-for-the-subway.jpg"
// becomes "Dinosaur waiting for the subway" (used as the alt text).
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const dir = "public/library";
const out = "src/lib/image-library.json";

const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .sort()
  : [];

const items = files.map((file) => {
  const words = file
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_ ]+/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return { file, title: words.charAt(0).toUpperCase() + words.slice(1) };
});

writeFileSync(out, JSON.stringify(items, null, 2) + "\n");
console.log(`image library: ${items.length} image(s)`);
