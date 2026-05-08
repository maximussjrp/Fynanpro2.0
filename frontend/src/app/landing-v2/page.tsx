'use client';

import HeroSection from '@/components/landing-v2/HeroSection';
import PainSection from '@/components/landing-v2/PainSection';
import MethodSection from '@/components/landing-v2/MethodSection';
import FeaturesSection from '@/components/landing-v2/FeaturesSection';
import AudienceSection from '@/components/landing-v2/AudienceSection';
import HumanAuthoritySection from '@/components/landing-v2/HumanAuthoritySection';
import DashboardDemoSection from '@/components/landing-v2/DashboardDemoSection';
import ProductShowcaseSection from '@/components/landing-v2/ProductShowcaseSection';
import PricingSection from '@/components/landing-v2/PricingSection';
import TrustSection from '@/components/landing-v2/TrustSection';
import FAQSection from '@/components/landing-v2/FAQSection';
import FinalCTASection from '@/components/landing-v2/FinalCTASection';
import LandingNav from '@/components/landing-v2/LandingNav';
import LandingFooter from '@/components/landing-v2/LandingFooter';

export default function LandingV2Page() {
  return (
    <div className="min-h-screen bg-[#080B14] text-[#F1F5F9] font-sans antialiased">
      <LandingNav />
      <main>
        <HeroSection />
        <PainSection />
        <MethodSection />
        <FeaturesSection />
        <AudienceSection />
        <HumanAuthoritySection />
        <DashboardDemoSection />
        <ProductShowcaseSection />
        <PricingSection />
        <TrustSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
