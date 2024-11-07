import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReportContext } from '../context/ReportContext';
import styled from 'styled-components';
import { 
  fetchReports, 
  generateReport, 
  downloadReport, 
  exportReportToCsv, 
  exportReportToExcel,
  cloneReportTemplate
} from '../services/api';
import { Alert, Spinner } from 'react-bootstrap';


const ReportsContainer = styled.div`
  padding: 20px;
  height: 100%;
  min-height: calc(100vh - 60px);
  overflow-y: visible;
  display: flex;
  flex-direction: column;
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
  const { reports, loading, addReport } = useContext(ReportContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  if (!isAuthenticated()) {
    return <div>Please log in to view reports.</div>;
  }

  if (loading) {
    return <div>Loading reports...</div>;
  }

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const newReport = await generateReport({ name: "New Report" });
      addReport(newReport);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      await downloadReport(reportId);
    } catch (error) {
      console.error('Error downloading report:', error);
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
    <ReportsContainer>
      <Heading>Reports</Heading>

      <ActionButtonContainer>
        <ActionButton onClick={handleGenerateReport} disabled={isGenerating}>
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
                <Td>
                  <ActionButton onClick={() => handleDownloadReport(report.id)}>
                    Download PDF
                  </ActionButton>
                  <ActionButton onClick={() => handleExportCsv(report.id)}>
                    Export CSV
                  </ActionButton>
                  <ActionButton onClick={() => handleExportExcel(report.id)}>
                    Export Excel
                  </ActionButton>
                </Td>
              </AnimatedTableRow>
            ))}
          </tbody>
        </StyledTable>
      )}
    </ReportsContainer>
  );
};

export default ReportsPage;
