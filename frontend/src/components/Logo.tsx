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
  const logoSrc = '/logo-nova-v2.png';

  const symbolSize = (() => {
    if (height && isIconOnly) return height;
    if (variant === 'icon-small') return 32;
    if (isIconOnly) return 40;
    if (height) return Math.min(height, 42);
    return showText ? 42 : 34;
  })();

  const symbolSrc = symbolSize <= 48 ? '/branding/favicons/favicon-32.png' : '/branding/favicons/favicon-512.png';
  if (isIconOnly) {
    return (
      <img
        src={symbolSrc}
        alt="UTOP"
        width={symbolSize}
        height={symbolSize}
        className={className}
        style={{ width: symbolSize, height: symbolSize, objectFit: 'contain' }}
      />
    );
  }

  const containerStyle: React.CSSProperties = {};
  if (width) containerStyle.width = width;
  if (height) containerStyle.height = height;
  const displayHeight = height || (showText ? 56 : 40);
  const displayWidth = width || Math.round(displayHeight * 1.15);

  return (
    <span
      className={`inline-block overflow-hidden ${className}`}
      style={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
        ...containerStyle,
      }}
    >
      <img
        src={logoSrc}
        alt="UTOP"
        width={1024}
        height={1024}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: displayHeight * 1.54,
          height: displayHeight * 1.54,
          maxWidth: 'none',
          transform: 'translate(-50%, -50%)',
          objectFit: 'cover',
        }}
      />
    </span>
  );
}
