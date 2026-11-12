// Regenerates the launcher icons from the website's logo files (public/icons).
// Run from android-app/:  node scripts/make-icons.cjs
const sharp = require("../../node_modules/sharp");
const fs = require("fs");
const path = require("path");

const RES = path.join(__dirname, "..", "android", "app", "src", "main", "res");
const SQUARE = path.join(__dirname, "..", "..", "public", "icons", "icon-512.png");
const MASKABLE = path.join(__dirname, "..", "..", "public", "icons", "maskable-512.png");
const DENS = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };

(async () => {
  for (const [d, [icon, fg]] of Object.entries(DENS)) {
    const dir = path.join(RES, "mipmap-" + d);
    fs.mkdirSync(dir, { recursive: true });
    const sq = await sharp(SQUARE).resize(icon, icon, { fit: "cover" }).png().toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher.png"), sq);
    const mask = Buffer.from(`<svg width="${icon}" height="${icon}"><circle cx="${icon / 2}" cy="${icon / 2}" r="${icon / 2}"/></svg>`);
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), await sharp(sq).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer());
    // adaptive foreground: the maskable logo already has its own safe margin
    const logo = await sharp(MASKABLE).resize(Math.round(fg * 0.9), Math.round(fg * 0.9)).png().toBuffer();
    fs.writeFileSync(
      path.join(dir, "ic_launcher_foreground.png"),
      await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: logo, gravity: "center" }])
        .png()
        .toBuffer(),
    );
  }
  console.log("icons written");
})();
