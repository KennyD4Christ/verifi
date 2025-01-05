import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReportContext } from '../context/ReportContext';
import ReportNameModal from '../modals/ReportNameModal';
import EmailReportModal from '../modals/EmailReportModal';
import styled, { keyframes } from 'styled-components';
import { ToastContainer, toast } from 'react-toastify';
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

const ActionButton = styled.button`
  background-color: #0645AD;
  color: white;
  border: none;
  padding: 10px 20px;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #052c65;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
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
  padding: 20px;
  height: 100%;
  min-height: calc(100vh - 60px);
  overflow-y: visible;
  display: flex;
  flex-direction: column;
`;

const StyledToastContainer = styled(ToastContainer)`
  .Toastify__toast {
    background-color: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
    font-size: 14px;
    border-radius: 5px;
    padding: 8px;
  }

  .Toastify__toast--success {
    background-color: #d4edda;
    color: #155724;
  }

  .Toastify__toast--error {
    background-color: #f8d7da;
    color: #721c24;
  }

  .Toastify__toast-container {
    width: 300px;
  }

  .Toastify__close-button {
    color: #555;
  }

  .Toastify__progress-bar {
    background-color: #17a2b8;
  }
`;

const TemplateSelect = styled.select`
  width: 100%;
  max-width: 300px;
  padding: 0.5rem;
  margin-bottom: 2rem;
  border: 1px solid #dce0e3;
  border-radius: 4px;
  background-color: white;
  color: #2c3e50;

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const Heading = styled.h1`
  color: #2c3e50;
  margin-bottom: 2rem;
  font-size: 2.5rem;
  font-weight: 600;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  background-color: #ffffff;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
  cursor: pointer;

  &:hover {
    background-color: #e9ecef;
  }
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

const ActionButtonContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AnimatedTableRow = styled.tr`
  animation: ${fadeIn} 0.3s ease;

  &:hover {
    transition: all 0.3s ease;
    background-color: #f0f8ff;
    transform: scale(1.01);
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
