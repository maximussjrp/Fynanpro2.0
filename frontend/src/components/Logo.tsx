/* eslint-disable @next/next/no-img-element */
interface LogoProps {
  variant?: 'horizontal-light' | 'horizontal-dark' | 'icon-gradient' | 'icon-dark' | 'icon-small' | 'full';
  format?: 'png' | 'svg';
  width?: number;
  height?: number;
  className?: string;
  showText?: boolean;
}

export default function Logo({
  variant = 'horizontal-light',
  width,
  height,
  className = '',
  showText = false,
}: LogoProps) {
  const isIconOnly = variant === 'icon-small' || variant === 'icon-gradient' || variant === 'icon-dark';
  const isDark = variant === 'horizontal-dark';

  // Tamanho do simbolo: respeita altura informada, senao default por variant
  const symbolSize = (() => {
    if (height) return height;
    if (variant === 'icon-small') return 32;
    if (isIconOnly) return 40;
    return 32; // horizontal default
  })();

  // Escolhe resolucao da imagem baseada no tamanho final
  // Para sizes pequenas, usa favicon-32; para maiores, usa favicon-512
  const symbolSrc = symbolSize <= 48 ? '/branding/favicons/favicon-32.png' : '/branding/favicons/favicon-512.png';

  // Cor do texto UTOP: claro em fundo escuro, escuro em fundo claro
  const textColor = isDark ? '#F5F7FB' : '#0B1020';

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  // Mantem o "showText" legado: render maior com bloco grande
  if (showText) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="flex items-center gap-3">
          <img
            src={symbolSrc}
            alt="UTOP"
            width={48}
            height={48}
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          <span
            className="text-3xl font-bold font-poppins"
            style={{ color: textColor, letterSpacing: '0.04em' }}
          >
            UTOP
          </span>
        </div>
      </div>
    );
  }

  if (isIconOnly) {
    return (
      <img
        src={symbolSrc}
        alt="UTOP"
        width={symbolSize}
        height={symbolSize}
        className={className}
        style={{ width: symbolSize, height: symbolSize, objectFit: 'contain', ...style }}
      />
    );
  }

  // Horizontal (light/dark): simbolo + wordmark
  return (
    <div className={`flex items-center gap-2 ${className}`} style={style}>
      <img
        src={symbolSrc}
        alt="UTOP"
        width={symbolSize}
        height={symbolSize}
        style={{ width: symbolSize, height: symbolSize, objectFit: 'contain' }}
      />
      <span
        className="font-bold font-poppins"
        style={{
          color: textColor,
          fontSize: Math.round(symbolSize * 0.6),
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        UTOP
      </span>
    </div>
  );
}
