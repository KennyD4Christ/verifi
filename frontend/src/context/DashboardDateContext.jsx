import React, { createContext, useContext, useState, useCallback } from 'react';
import moment from 'moment-timezone';
import { dateUtils } from '../utils/dateUtils';

const DashboardDateContext = createContext(null);

export const DashboardDateProvider = ({ children }) => {
  const [dateRange, setDateRange] = useState(() => {
    const { startDate, endDate } = dateUtils.getPresetDateRange('30days');
    return [startDate, endDate];
  });

  const updateDateRange = useCallback((newDates) => {
    try {
      if (!newDates) {
        // If clearing the date picker, return to default range
        const defaultRange = dateUtils.getPresetDateRange('30days');
        setDateRange([defaultRange.startDate, defaultRange.endDate]);
        return defaultRange;
      }

      // Extract and validate dates
      const [start, end] = newDates;
      
      if (!start || !end) {
        console.log('Missing start or end date');
        return { startDate: dateRange[0], endDate: dateRange[1] };
      }

      // Create new moment objects from the dates
      const startMoment = moment(start).startOf('day');
      const endMoment = moment(end).endOf('day');

      console.log('Updating date range with:', {
        start: startMoment.format('YYYY-MM-DD'),
        end: endMoment.format('YYYY-MM-DD')
      });

      // Set the new date range
      setDateRange([startMoment, endMoment]);

      return {
        startDate: startMoment,
        endDate: endMoment,
        formattedStartDate: startMoment.format('YYYY-MM-DD'),
        formattedEndDate: endMoment.format('YYYY-MM-DD')
      };
    } catch (error) {
      console.error('Error updating date range:', error);
      return { startDate: dateRange[0], endDate: dateRange[1] };
    }
  }, [dateRange]);

  return (
    <DashboardDateContext.Provider value={{ dateRange, updateDateRange }}>
      {children}
    </DashboardDateContext.Provider>
  );
};

export const useDashboardDate = () => {
  const context = useContext(DashboardDateContext);
  if (!context) {
    throw new Error('useDashboardDate must be used within a DashboardDateProvider');
  }
  return context;
};
