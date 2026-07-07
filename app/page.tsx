import HeroSection from '../components/landing/HeroSection'
import WhaleActivity from '../components/landing/WhaleActivity'
import WalletIntelligence from '../components/landing/WalletIntelligence'
import TrendingNarratives from '../components/landing/TrendingNarratives'
import Features from '../components/landing/Features'
import Pricing from '../components/landing/Pricing'
import Testimonials from '../components/landing/Testimonials'
import FAQ from '../components/landing/FAQ'

export default function Home(){
  return (
    <main>
      <HeroSection />
      <WhaleActivity />
      <WalletIntelligence />
      <TrendingNarratives />
      <Features />
      <Pricing />
      <Testimonials />
      <FAQ />
    </main>
  )
}
