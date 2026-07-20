import type { Metadata } from 'next'
import Nav from '@/components/home/Nav'
import Hero from '@/components/home/Hero'
import ProjectDeepDive from '@/components/home/ProjectDeepDive'
import SkillsMastery from '@/components/home/SkillsMastery'
import StatsBar from '@/components/home/StatsBar'
import HowWeBuild from '@/components/home/HowWeBuild'
import ContactForm from '@/components/home/ContactForm'
import Footer from '@/components/home/Footer'

export const metadata: Metadata = {
  title: 'Brad Perry Enterprises — Web Designer & Niche Site Operator',
  description: 'Building high-converting affiliate networks that generate consistent revenue through expert design and strategic optimization.',
}

export default function HomePage() {
  return (
    <>
      <Nav />
      <Hero />
      <ProjectDeepDive />
      <SkillsMastery />
      <StatsBar />
      <HowWeBuild />
      <ContactForm />
      <Footer />
    </>
  )
}
