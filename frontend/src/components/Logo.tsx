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
  format = 'png',
  width, 
  height, 
  className = '',
  showText = false
}: LogoProps) {
  const logoMap = {
    'horizontal-light': `/images/logo/logo-horizontal-light.${format}`,
    'horizontal-dark': `/images/logo/logo-horizontal-dark.${format}`,
    'icon-gradient': `/images/logo/logo-icon-gradient.${format}`,
    'icon-dark': `/images/logo/logo-icon-dark.${format}`,
    'icon-small': `/images/logo/icon-small-1.png`,
    'full': `/images/logo/logo-icon-gradient.${format}`,
  };

  const src = logoMap[variant];
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  if (showText) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-xl flex items-center justify-center border border-[#C9A962]">
            <span className="text-[#C9A962] font-bold text-xl">U</span>
          </div>
          <span className="text-3xl font-bold text-[#0F172A] font-poppins">UTOP</span>
        </div>
      </div>
    );
  }

  // UTOP Logo Icon
  return (
    <div className={`flex items-center gap-2 ${className}`} style={style}>
      <div className="w-8 h-8 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-lg flex items-center justify-center border border-[#C9A962]">
        <span className="text-[#C9A962] font-bold text-sm">U</span>
      </div>
      {!style?.width || (style.width as number) > 50 ? (
        <span className="text-xl font-bold text-[#0F172A] font-poppins">UTOP</span>
      ) : null}
    </div>
  );
}
