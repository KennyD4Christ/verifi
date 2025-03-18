import React from 'react';
import { useState } from 'react';

const DateRangeSelector = ({ onDateRangeChange }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleDateChange = (newStartDate, newEndDate) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    onDateRangeChange({ startDate: newStartDate, endDate: newEndDate });
  };

  return (
    <div className="flex gap-4 items-center mb-4">
      <div className="flex items-center gap-2">
        <label htmlFor="start-date" className="text-sm font-medium">
          Start Date:
        </label>
        <input
          type="date"
          id="start-date"
          value={startDate}
          onChange={(e) => handleDateChange(e.target.value, endDate)}
          className="border rounded px-2 py-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="end-date" className="text-sm font-medium">
          End Date:
        </label>
        <input
          type="date"
          id="end-date"
          value={endDate}
          onChange={(e) => handleDateChange(startDate, e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>
    </div>
  );
};

export default DateRangeSelector;
