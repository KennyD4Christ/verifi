import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchReports, createReport, cloneReportTemplate } from '../services/api';
import { useAuth } from './AuthContext';

export const ReportContext = createContext();

const ReportProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchReports();
        setReports(data);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [isAuthenticated]);

  const addReport = async (report) => {
    try {
      console.log('Creating report with payload:', report);
      const newReport = await createReport(report);
      console.log('New report created:', newReport);

      // Optional: Refetch reports to ensure consistency
      const updatedReports = await fetchReports();
      setReports(updatedReports);

      return newReport;
    } catch (error) {
      console.error('Detailed error in report creation:', error);
    
      const errorMessage = 
        error.response?.data?.name?.[0] ||
        error.response?.data?.detail ||
        error.message ||
        'Failed to create report. Please check your input.';

      throw new Error(errorMessage);
    }
  };

  const cloneTemplate = async (templateId) => {
    try {
      const clonedReport = await cloneReportTemplate(templateId);
      setReports((prevReports) => [...prevReports, clonedReport]);
      return clonedReport;
    } catch (error) {
      console.error('Failed to clone template:', error);
      throw new Error('Failed to clone template');
    }
  };

  const updateReport = (updatedReport) => {
    setReports((prevReports) =>
      prevReports.map((report) =>
        report.id === updatedReport.id ? updatedReport : report
      )
    );
  };

  return (
    <ReportContext.Provider value={{ reports, loading, addReport, updateReport, cloneReportTemplate }}>
      {children}
    </ReportContext.Provider>
  );
};

export default ReportProvider;
