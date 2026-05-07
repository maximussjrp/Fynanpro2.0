/* eslint-disable @typescript-eslint/no-var-requires */
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const MASTER = path.join(__dirname, '..', 'public', 'branding', 'master-icon.png');
const OUT = path.join(__dirname, '..', 'public', 'branding', 'favicons');
const PUBLIC = path.join(__dirname, '..', 'public');

if (!fs.existsSync(MASTER)) {
  console.error('Master nao encontrado:', MASTER);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512];

(async () => {
  for (const size of SIZES) {
    const out = path.join(OUT, `favicon-${size}.png`);
    await sharp(MASTER).resize(size, size, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toFile(out);
    console.log(`gerado favicon-${size}.png`);
  }

  // .ico multi-resolução (16 + 32 + 48)
  const icoSources = [16, 32, 48].map((s) => path.join(OUT, `favicon-${s}.png`));
  const icoBuffer = await pngToIco(icoSources);
  fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuffer);
  console.log('gerado public/favicon.ico (16+32+48)');

  // apple-touch-icon padronizado em /public
  fs.copyFileSync(path.join(OUT, 'favicon-180.png'), path.join(PUBLIC, 'apple-touch-icon.png'));
  fs.copyFileSync(path.join(OUT, 'favicon-192.png'), path.join(PUBLIC, 'icon-192.png'));
  fs.copyFileSync(path.join(OUT, 'favicon-512.png'), path.join(PUBLIC, 'icon-512.png'));
  console.log('publicados apple-touch-icon, icon-192, icon-512');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
