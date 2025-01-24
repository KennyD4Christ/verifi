import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SuccessStories from './SuccessStories';
import { 
  ArrowRight, 
  BarChart2, 
  Lock, 
  Database, 
  DollarSign, 
  Clock, 
  Menu, 
  X,
  ChevronRight,
  Play
} from 'lucide-react';
import VerifiLogo from './common/VerifiLogo';
import styled from 'styled-components';
import { ThemeProvider } from "styled-components";

const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const NavContainer = styled.nav`
  position: fixed;
  width: 100%;
  top: 53px;
  z-index: 50;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  height: 100%;

  img {
    max-height: 40px;
    width: auto;
    object-fit: contain;
  }
`;

const MobileMenuContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'translateY(0)' : 'translateY(-100%)')};
  opacity: ${({ isOpen }) => (isOpen ? '1' : '0')};
  visibility: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
`;

const MainContainer = styled.main`
  padding-top: 4rem;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  position: relative;
`;

const HeroSection = styled.div`
  background-color: ${getThemeValue('colors.secondary', '#2c5282')};
  position: relative;
  overflow: hidden;
`;

const HeroContent = styled.div`
  max-width: 80rem;
  margin: 0 auto;
  padding: 6rem 1rem;

  @media (min-width: 640px) {
    padding: 8rem 1.5rem;
  }
`;

const GridContainer = styled.div`
  display: grid;
  gap: 2rem;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    align-items: center;
  }
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.15s ease-in-out;
`;

const PrimaryButton = styled(Button)`
  background: white;
  color: #2563eb;

  &:hover {
    background: #eff6ff;
  }
`;

const SecondaryButton = styled(Button)`
  background: transparent;
  border: 2px solid white;
  color: white;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const Modal = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
`;

const Card = styled.div`
  background-color: ${props => props.theme.cardBackground};
  border-radius: 12px;
  box-shadow: ${props => props.theme.card.shadow};
  padding: clamp(16px, 2.5vw, 24px);
  width: 100%;
  min-width: 0;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.elevated ?
      '0 8px 16px rgba(0, 0, 0, 0.1)' :
      props.theme.card.shadow};
  }

  .scrollable-content {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
    scrollbar-width: thin;

    &::-webkit-scrollbar {
      height: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: ${props => props.theme.secondary};
      border-radius: 3px;
    }
  }
`;

const FeatureCard = styled(Card)`                                                                                                                 padding: 1.5rem;                                                                                                                                transition: all 0.3s ease;                                                                                                                                                                                                                                                                      &:hover {                                                                                                                                         border-color: #60a5fa;                                                                                                                          transform: translateY(-2px);                                                                                                                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);                                                                                              }                                                                                                                                             `;                                                                                                                                                                                                                                                                                              const VideoCard = styled(Card)`
  background-color: white;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .thumbnail-container {
    position: relative;

    &:hover .play-overlay {
      background-color: rgba(0, 0, 0, 0.3);
    }

    &:hover .play-icon {
      transform: scale(1.1);
    }
  }
`;

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const features = [
    {
      name: 'Powerful Analytics',
      description: 'Gain actionable insights to drive business growth with our advanced analytics tools.',
      icon: BarChart2,
    },
    {
      name: 'Secure Transactions',
      description: 'Bank-level encryption keeps your financial data protected at all times.',
      icon: Lock,
    },
    {
      name: 'Real-time Inventory',
      description: 'Track stock levels across multiple locations instantly, preventing stockouts and overstock.',
      icon: Database,
    },
    {
      name: 'Financial Forecasting',
      description: 'Make informed decisions with AI-powered financial projections and cash flow forecasts.',
      icon: DollarSign,
    },
    {
      name: 'Time-Saving Automation',
      description: 'Automate repetitive tasks, reducing manual errors and freeing up your time.',
      icon: Clock,
    },
  ];

  const testimonials = [
    {
      id: 1,
      company: 'Tech Solutions Inc.',
      testimonial: 'Verifi transformed our financial operations...',
      videoUrl: '/videos/testimonial1.mp4',
    },
    {
      id: 2,
      company: 'Global Retail Co.',
      testimonial: 'The inventory management features are incredible...',
      videoUrl: '/videos/testimonial2.mp4',
    },
    {
      id: 3,
      company: 'StartUp Ventures',
      testimonial: 'Perfect solution for growing businesses...',
      videoUrl: '/videos/testimonial3.mp4',
    },
    {
      id: 4,
      company: 'Enterprise Systems',
      testimonial: 'Seamless integration and powerful analytics...',
      videoUrl: '/videos/testimonial4.mp4',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <NavContainer>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded={isMenuOpen}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <MobileMenuContainer isOpen={isMenuOpen}>
          <div className="px-2 pt-2 pb-3 space-y-1 shadow-lg">
            <Link to="/about" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50">About</Link>
            <Link to="/pricing" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50">Pricing</Link>
            <Link to="/contact" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50">Contact</Link>
            <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50">Login</Link>
            <Link to="/register" className="block w-full text-center px-4 py-2 rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700">Get Started</Link>
          </div>
        </MobileMenuContainer>
      </NavContainer>

      <MainContainer>
        <HeroSection>
          <HeroContent>
            <GridContainer>
              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                  Streamline Your Financial Operations
                </h1>
                <p className="text-lg sm:text-xl text-white mb-8">
                  Transform your business with our comprehensive accounting and inventory management system. Boost efficiency, reduce costs, and make data-driven decisions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <PrimaryButton as={Link} to="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </PrimaryButton>
                  <SecondaryButton>
                    <Play className="mr-2 h-5 w-5" />
                    Watch Demo
                  </SecondaryButton>
                </div>
              </div>
            </GridContainer>
          </HeroContent>
        </HeroSection>

        {/* Features Section */}
        <div className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Everything you need to succeed
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
                Powerful features designed to help your business thrive in the digital age.
              </p>
            </div>

            <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <FeatureCard
                    key={feature.name}
                    className="relative group p-6 hover:border-blue-400 transition-all duration-300 hover:shadow-lg"
                  >
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium">
                        {feature.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                  </FeatureCard>
                );
              })}
            </div>
          </div>
        </div>
        <SuccessStories testimonials={testimonials} onVideoSelect={setActiveVideo} />
      </MainContainer>

      {/* Video Modal */}
      {activeVideo && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div className="max-w-4xl w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video
              controls
              autoPlay
              className="w-full h-full"
              src={testimonials.find(t => t.id === activeVideo)?.videoUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
