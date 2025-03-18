import React from 'react';
import { Building2, Play, Quote } from 'lucide-react';
import styled from 'styled-components';
import { ThemeProvider } from "styled-components";


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

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

const VideoCard = ({ testimonial, onClick }) => {
  // Generate a consistent background color based on company name
  const getBackgroundColor = (company) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700'
    ];
    return colors[testimonial.id % colors.length];
  };
  
  return (
    <Card
      className="overflow-hidden bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
      onClick={onClick}
    >
      {/* Video Thumbnail Section - Enhanced */}
      <div className="relative group">
        <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
          {/* Circular play button with improved visibility */}
          <div className="bg-white bg-opacity-15 p-4 rounded-full group-hover:bg-opacity-25 transition-all duration-300">
            <Play className="w-10 h-10 text-white group-hover:scale-110 transition-all duration-300" />
          </div>
          
          {/* Video duration indicator */}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            2:45
          </div>
          
          {/* Video label */}
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <Play className="w-3 h-3 mr-1" />
            <span>VIDEO</span>
          </div>
        </div>
      </div>
      
      {/* Company Information Section */}
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className={`w-12 h-12 rounded-full ${getBackgroundColor(testimonial.company)} flex items-center justify-center`}>
            <Building2 className="w-6 h-6" />
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900">{testimonial.company}</h3>
          </div>
        </div>
        
        {/* Testimonial Content */}
        <div className="relative">
          <Quote className="w-8 h-8 text-gray-200 absolute -top-2 -left-2" />
          <p className="text-gray-600 text-sm pl-6 pt-2 italic">
            {testimonial.testimonial}
          </p>
        </div>
        
        {/* Explicit watch video text */}
        <div className="mt-4 flex items-center text-blue-600 font-medium text-sm">
          <Play className="w-4 h-4 mr-1" />
          <span>Watch video testimonial</span>
        </div>
      </div>
    </Card>
  );
};

const SuccessStories = ({ testimonials, onVideoSelect }) => {
  return (
    <div className="bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Success Stories
          </h2>
          <p className="mt-4 text-xl text-gray-500">
            See how businesses like yours achieve success with Verifi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial) => (
            <VideoCard
              key={testimonial.id}
              testimonial={testimonial}
              onClick={() => onVideoSelect(testimonial.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuccessStories;
