import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import QuickLinksSection from "@/components/sections/QuickLinksSection";
import CasesSection from "@/components/sections/CasesSection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ServicesSection />
      <QuickLinksSection />
      <CasesSection />
    </Layout>
  );
};

export default Index;
