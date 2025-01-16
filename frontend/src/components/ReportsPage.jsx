import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReportContext } from '../context/ReportContext';
import ReportNameModal from '../modals/ReportNameModal';
import EmailReportModal from '../modals/EmailReportModal';
import styled, { keyframes } from 'styled-components';
import { ToastContainer, toast } from 'react-toastify';
import { ThemeProvider } from "styled-components";
import 'react-toastify/dist/ReactToastify.css';
import DateRangeSelector from '../modals/DateRangeModal';
import { 
  fetchReports, 
  generateReport, 
  downloadReport, 
  exportReportToCsv, 
  exportReportToExcel,
  deleteReport,
  cloneReportTemplate,
  sendReportEmail
} from '../services/api';
import { Alert, Spinner, Button, Modal } from 'react-bootstrap';
import { format } from 'date-fns';


const ExportConfirmationModal = ({ show, onHide, onConfirm, dateRange, isExporting }) => (
  <Modal show={show} onHide={onHide}>
    <Modal.Header closeButton>
      <Modal.Title>Export Report Configuration</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p>Please confirm the date range for your export:</p>
      <div className="mb-3">
        <strong>Start Date:</strong> {dateRange.startDate || 'Not specified (will use default range)'}
      </div>
      <div className="mb-3">
        <strong>End Date:</strong> {dateRange.endDate || 'Not specified (will use default range)'}
      </div>
      <p className="text-muted">
        Note: The exported report will include comprehensive financial metrics and analysis for the selected period.
      </p>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>Cancel</Button>
      <Button 
        variant="primary" 
        onClick={onConfirm}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Confirm Export'}
      </Button>
    </Modal.Footer>
  </Modal>
);

const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 2rem;
  background-color: ${getThemeValue('colors.background', '#0645AD')};
  border: 1px solid ${getThemeValue('colors.border', '#0645AD')};
  border-radius: 4px;
  overflow: hidden;
`;

const ActionButton = styled.button`
  background-color: ${getThemeValue('colors.primary', '#1a365d')};
  color: white;
  border: none;
  padding: 12px 24px;
  font-weight: 500;
  border-radius: 3px;
  cursor: pointer;
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};
  font-size: 0.875rem;
  letter-spacing: 0.025em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: ${getThemeValue('colors.secondary', '#2c5282')};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    background-color: #cbd5e0;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;


const StyledActionButton = styled(ActionButton)`
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  &.export-btn {
    background-color: #2c3e50;
    &:hover {
      background-color: #34495e;
    }
  }
`;


const ActionCell = styled.td`
  display: flex;
  gap: 8px;
  padding: 8px;
  align-items: center;
`;

const ReportsContainer = styled.div`
  padding: 2rem;
  height: 100%;
  min-height: calc(100vh - var(--header-height, 64px));
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const StyledToastContainer = styled(ToastContainer)`
  .Toastify__toast {
    background-color: ${getThemeValue('colors.surface', '#f7fafc')};
    color: ${getThemeValue('colors.text.primary', '#2d3748')};
    border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
    font-size: 0.875rem;
    border-radius: 3px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .Toastify__toast--success {
    background-color: #f0fff4;
    color: #2f855a;
    border-color: #c6f6d5;
  }

  .Toastify__toast--error {
    background-color: #fff5f5;
    color: #c53030;
    border-color: #fed7d7;
  }
`;

const TemplateSelect = styled.select`
  width: 100%;
  max-width: 300px;
  padding: 0.75rem;
  margin-bottom: 2rem;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  border-radius: 3px;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  font-size: 0.875rem;
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};

  &:focus {
    outline: none;
    border-color: ${getThemeValue('colors.accent', '#2b6cb0')};
    box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.1);
  }
`;

const Heading = styled.h1`
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  padding-bottom: 1rem;
`;

const Th = styled.th`
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  color: ${getThemeValue('colors.text.secondary', '#4a5568')};
  padding: 1rem;
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid ${getThemeValue('colors.border', '#e2e8f0')};
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
  font-size: 0.875rem;
`;

const ActionButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AnimatedTableRow = styled.tr`
  transition: ${getThemeValue('transitions.standard', 'all 0.2s ease-in-out')};

  &:hover {
    background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  }
`;


const ReportsPage = () => {
  const { isAuthenticated } = useAuth();
  const { loading, addReport } = useContext(ReportContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [reports, setReports] = useState([]);
  const [showReportNameModal, setShowReportNameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportId, setSelectedExportId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isAuthenticated()) {
    return <div>Please log in to view reports.</div>;
  }

  if (loading) {
    return <div>Loading reports...</div>;
  }

  // Fetch existing report names for validation
  const existingReportNames = reports.map(report => report.name);

  const handleDateRangeChange = (newDateRange) => {
    setDateRange({
      startDate: newDateRange.startDate ? format(new Date(newDateRange.startDate), 'yyyy-MM-dd') : '',
      endDate: newDateRange.endDate ? format(new Date(newDateRange.endDate), 'yyyy-MM-dd') : ''
    });
  };

  const handleGenerateReport = async (reportName) => {
    setIsGenerating(true);
    try {
      const cleanReportName = typeof reportName === 'string'
        ? reportName.trim()
        : (reportName.target.value || '').trim();

      if (!cleanReportName) {
        toast.error('Report name is required');
        return;
      }

      const reportPayload = {
        name: cleanReportName,
        description: `Generated on ${new Date().toLocaleString()}`,
        is_template: false,
	startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null
      };

      const newReport = await addReport(reportPayload);

      setReports(prevReports => [...prevReports, newReport]);

      toast.success(`Report "${cleanReportName}" generated successfully!`);
      setShowReportNameModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectReportGeneration = () => {
    // This method handles direct button click
    setShowReportNameModal(true);
  };

  const handleEmailSubmit = async (emailData) => {
    try {
      await sendReportEmail(selectedReport.id, emailData, dateRange);
      toast.success('Report sent successfully!');
      setShowEmailModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to send email');
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      await downloadReport(reportId, dateRange.startDate, dateRange.endDate);
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await deleteReport(reportId);
      // Refresh reports list or remove deleted report from state
      setReports(currentReports => 
        currentReports.filter(report => report.id !== reportId)
      );
      toast.success("Report deleted successfully");
    } catch (error) {
      toast.error(error.message);
      console.error('Error deleting report:', error);
    }
  };

  const handleExportCsv = async (reportId) => {
    setSelectedExportId(reportId);
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange.endDate) params.append('end_date', dateRange.endDate);

      const response = await exportReportToCsv(selectedExportId, params);
      
      // Create a temporary link to trigger the download
      const link = document.createElement('a');
      link.href = response.file_url;
      link.download = `${response.filename || 'report.csv'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Report exported successfully!');
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(error.response?.data?.details || 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async (reportId) => {
    try {
      const { url, filename } = await exportReportToExcel(reportId);
    
      // Create a link element and trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report to Excel:', error);
      toast.error(error.message || 'Failed to export report');
    }
  };

  const handleCloneTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      const newReport = await cloneReportTemplate(selectedTemplate);
      addReport(newReport);
    } catch (error) {
      console.error('Error cloning report template:', error);
    }
  };

  const renderActionButtons = (report) => (
    <ActionCell>
      <StyledActionButton onClick={() => handleDownloadReport(report.id)}>
        Download PDF
      </StyledActionButton>
      <StyledActionButton
        className="export-btn"
        onClick={() => handleExportCsv(report.id)}
        disabled={isExporting}
      >
        Export CSV
      </StyledActionButton>
      <StyledActionButton onClick={() => handleExportExcel(report.id)}>
        Export Excel
      </StyledActionButton>
      <StyledActionButton
        onClick={() => {
          setSelectedReport(report);
          setShowEmailModal(true);
        }}
      >
        Email Report
      </StyledActionButton>
      <StyledActionButton
        variant="danger"
        onClick={() => handleDeleteReport(report.id)}
      >
        Delete
      </StyledActionButton>
    </ActionCell>
  );

  return (
    <>
      <EmailReportModal
        show={showEmailModal}
        onHide={() => setShowEmailModal(false)}
        onSubmit={handleEmailSubmit}
        report={selectedReport}
      />
      <ReportNameModal
        show={showReportNameModal}
        onHide={() => setShowReportNameModal(false)}
        onSubmit={handleGenerateReport}
        existingReportNames={existingReportNames}
      />
      <ExportConfirmationModal
        show={showExportModal}
        onHide={() => setShowExportModal(false)}
        onConfirm={confirmExport}
        dateRange={dateRange}
        isExporting={isExporting}
      />
      <StyledToastContainer />
      <ReportsContainer>
        <Heading>Reports</Heading>
        
        <DateRangeSelector onDateRangeChange={handleDateRangeChange} />

        <ActionButtonContainer>
          <ActionButton onClick={handleDirectReportGeneration} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </ActionButton>
          <ActionButton
            onClick={handleCloneTemplate}
            disabled={!selectedTemplate}
          >
            Clone Template
          </ActionButton>
        </ActionButtonContainer>

        <TemplateSelect
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          <option value="">Select a template</option>
          {reports
            .filter(r => r.is_template)
            .map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
        </TemplateSelect>

        {loading ? (
          <Spinner animation="border" role="status" className="text-center" />
        ) : (
          <StyledTable>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Created At</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <AnimatedTableRow key={report.id}>
                  <Td>{report.id}</Td>
                  <Td>{report.name}</Td>
                  <Td>{new Date(report.created_at).toLocaleString()}</Td>
                  {renderActionButtons(report)}
                </AnimatedTableRow>
              ))}
            </tbody>
          </StyledTable>
        )}
      </ReportsContainer>
    </>
  );
};

export default ReportsPage;
