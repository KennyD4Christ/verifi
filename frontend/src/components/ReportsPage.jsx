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


const ReportsContainer = styled.div`
  padding: 20px;
`;

const Heading = styled.h1`
  font-size: 2em;
  margin-bottom: 20px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
`;

const Th = styled.th`
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
`;

const Td = styled.td`
  padding: 10px;
  border: 1px solid #ddd;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
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

      <Button onClick={handleGenerateReport} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </Button>

      <div>
        <select 
          value={selectedTemplate} 
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          <option value="">Select a template</option>
          {reports.filter(r => r.is_template).map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        <Button onClick={handleCloneTemplate} disabled={!selectedTemplate}>
          Clone Template
        </Button>
      </div>

      <Table>
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
            <tr key={report.id}>
              <Td>{report.id}</Td>
              <Td>{report.name}</Td>
              <Td>{new Date(report.created_at).toLocaleString()}</Td>
              <Td>
                <Button onClick={() => handleDownloadReport(report.id)}>Download PDF</Button>
                <Button onClick={() => handleExportCsv(report.id)}>Export CSV</Button>
                <Button onClick={() => handleExportExcel(report.id)}>Export Excel</Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ReportsContainer>
  );
};

export default ReportsPage;
