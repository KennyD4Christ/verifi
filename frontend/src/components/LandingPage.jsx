import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, Lock, Database, DollarSign, Clock, Menu, X } from 'lucide-react';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-blue-50">
      <nav className="bg-white shadow-md relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <img className="h-8 w-auto text-blue-600" src="/logo.svg" alt="Logo" />
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
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
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden absolute w-full bg-white shadow-lg`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link to="/about" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">About Us</Link>
            <Link to="/pricing" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Pricing</Link>
            <Link to="/contact" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Contact</Link>
            <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Login</Link>
            <Link to="/register" className="block w-full text-center px-4 py-2 rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700">Sign up</Link>
          </div>
        </div>
      </nav>

      <main>
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-800">
          <div className="absolute inset-0 bg-custom-pattern opacity-10"></div>
          <div className="relative max-w-7xl mx-auto py-12 sm:py-24 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white text-center sm:text-left">
              Take Control of Your Finances
            </h1>
            <p className="mt-4 sm:mt-6 max-w-3xl text-lg sm:text-xl text-blue-100 text-center sm:text-left">
              Streamline Your Business with Our Accounting & Inventory System. Save time, reduce errors, and boost profitability.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center sm:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/register" className="w-full sm:w-auto flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-blue-700 bg-white hover:bg-blue-50 transition duration-150 ease-in-out sm:px-8">
                Get Started Free
              </Link>
              <Link to="/demo" className="w-full sm:w-auto flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-500 hover:bg-blue-600 transition duration-150 ease-in-out sm:px-8">
                Schedule a Demo
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white py-12 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">All-in-one solution for your business</h2>
              <p className="mt-4 text-base sm:text-lg md:text-xl text-gray-500">Everything you need to manage your finances and inventory, all in one powerful platform.</p>
            </div>
            <div className="mt-12 sm:mt-20 grid grid-cols-1 gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} className="relative bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out border border-gray-200">
                  <dt>
                    <div className="absolute flex items-center justify-center h-10 sm:h-12 w-10 sm:w-12 rounded-md bg-blue-500 text-white">
                      <feature.icon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-14 sm:ml-16 text-base sm:text-lg leading-6 font-medium text-gray-900">{feature.name}</p>
                  </dt>
                  <dd className="mt-2 ml-14 sm:ml-16 text-sm sm:text-base text-gray-500">{feature.description}</dd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-blue-50 py-12 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
                  Trusted by businesses worldwide
                </h2>
                <p className="mt-3 text-base sm:text-lg text-gray-500">
                  Join thousands of satisfied customers who have transformed their business operations with our system.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                  <Link to="/testimonials" className="w-full sm:w-auto flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    View Testimonials
                  </Link>
                  <Link to="/case-studies" className="w-full sm:w-auto flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                    Read Case Studies
                  </Link>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:mt-0 lg:grid-cols-2">
                {['client1.svg', 'client2.svg', 'client3.svg', 'client4.svg', 'client5.svg', 'client6.svg'].map((client) => (
                  <div key={client} className="col-span-1 flex justify-center py-4 sm:py-8 px-4 sm:px-8 bg-white rounded-lg shadow-sm">
                    <img
                      className="max-h-8 sm:max-h-12 filter grayscale hover:grayscale-0 transition duration-300"
                      src={`/clients/${client}`}
                      alt="Client"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            <div className="space-y-8 xl:col-span-1">
              <img className="h-8 sm:h-10 text-white" src="/logo.svg" alt="Company name" />
              <p className="text-sm sm:text-base text-gray-400">
                Making the world a better place through efficient business management.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-white transition duration-150 ease-in-out">
                  <span className="sr-only">Facebook</span>
                  <svg className="h-6 w-6" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-150 ease-in-out">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-6 w-6" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Solutions</h3>
                  <ul className="mt-4 space-y-3 sm:space-y-4">
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Accounting</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Inventory Management</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Reporting</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Integrations</a></li>
                  </ul>
                </div>
                <div className="mt-8 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Support</h3>
                  <ul className="mt-4 space-y-3 sm:space-y-4">
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Pricing</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Documentation</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Guides</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">API Status</a></li>
                  </ul>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
                  <ul className="mt-4 space-y-3 sm:space-y-4">
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">About</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Blog</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Jobs</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Press</a></li>
                  </ul>
                </div>
                <div className="mt-8 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
                  <ul className="mt-4 space-y-3 sm:space-y-4">
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Privacy</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Terms</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Cookie Policy</a></li>
                    <li><a href="#" className="text-sm sm:text-base text-gray-300 hover:text-white">Licensing</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 sm:mt-12 border-t border-gray-700 pt-8">
            <p className="text-sm sm:text-base text-gray-400 text-center">
              &copy; 2024 Verifi. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
