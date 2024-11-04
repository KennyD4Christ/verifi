import moment from 'moment-timezone';

export const dateUtils = {
  processDateRange: (start, end) => {
    const startMoment = moment(start).startOf('day');
    const endMoment = moment(end).endOf('day');

    if (!startMoment.isValid() || !endMoment.isValid()) {
      throw new Error('Invalid date range provided');
    }

    return {
      startDate: startMoment,
      endDate: endMoment,
      formattedStartDate: startMoment.format('YYYY-MM-DD'),
      formattedEndDate: endMoment.format('YYYY-MM-DD')
    };
  },

  formatDateForAPI(date) {
    const momentDate = moment.isMoment(date) ? date : moment(date);
    return momentDate.format('YYYY-MM-DD');
  },

  // Helper for revenue calculations
  getDateRangeParams(days) {
    const end = moment().endOf('day');
    const start = moment().subtract(days, 'days').startOf('day');
    return this.processDateRange(start, end);
  },

  getPresetDateRange: (preset) => {
    const end = moment().endOf('day');
    let start;

    switch (preset) {
      case '7days':
        start = moment().subtract(7, 'days').startOf('day');
        break;
      case '30days':
        start = moment().subtract(30, 'days').startOf('day');
        break;
      case '90days':
        start = moment().subtract(90, 'days').startOf('day');
        break;
      default:
        start = moment().subtract(30, 'days').startOf('day');
    }

    return {
      startDate: start,
      endDate: end,
      formattedStartDate: start.format('YYYY-MM-DD'),
      formattedEndDate: end.format('YYYY-MM-DD')
    };
  }
};
