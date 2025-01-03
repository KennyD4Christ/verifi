import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReportContext } from '../context/ReportContext';
import ReportNameModal from '../modals/ReportNameModal';
import EmailReportModal from '../modals/EmailReportModal';
import styled from 'styled-components';
import { ToastContainer, toast } from 'react-toastify';
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
import { Alert, Spinner } from 'react-bootstrap';


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

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
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

const AnimatedTableRow = styled.tr`
  transition: all 0.3s ease;

  &:hover {
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

  if (!isAuthenticated()) {
    return <div>Please log in to view reports.</div>;
  }

  if (loading) {
    return <div>Loading reports...</div>;
  }

  // Fetch existing report names for validation
  const existingReportNames = reports.map(report => report.name);

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
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

  const renderActionButtons = (report) => (
    <ActionCell>
      <ActionButton onClick={() => handleDownloadReport(report.id)}>
        Download PDF
      </ActionButton>
      <ActionButton onClick={() => handleExportCsv(report.id)}>
        Export CSV
      </ActionButton>
      <ActionButton onClick={() => handleExportExcel(report.id)}>
        Export Excel
      </ActionButton>
      <ActionButton onClick={() => {
        setSelectedReport(report);
        setShowEmailModal(true);
      }}>
        Email Report
      </ActionButton>
      <ActionButton
        variant="danger"
        onClick={() => handleDeleteReport(report.id)}
      >
        Delete
      </ActionButton>
    </ActionCell>
  );

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
    try {
      const csvUrl = await exportReportToCsv(reportId);
      window.open(csvUrl, '_blank');
    } catch (error) {
      console.error('Error exporting report to CSV:', error);
    }
  };

  const handleExportExcel = async (reportId) => {
    try {
      const excelUrl = await exportReportToExcel(reportId);
      window.open(excelUrl, '_blank');
    } catch (error) {
      console.error('Error exporting report to Excel:', error);
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

        <div>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="form-control"
          >
            <option value="">Select a template</option>
            {reports.filter(r => r.is_template).map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <Spinner animation="border" role="status" className="d-block mx-auto" />
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
