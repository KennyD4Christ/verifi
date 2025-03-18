import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';

const ReportNameModal = ({ 
  show, 
  onHide, 
  onSubmit, 
  existingReportNames = [] 
}) => {
  const [reportName, setReportName] = useState('');
  const [error, setError] = useState('');

  const validateReportName = (name) => {
    // Trim whitespace and check various validation criteria
    const trimmedName = name.trim();

    if (!trimmedName) {
      return 'Report name cannot be empty';
    }

    if (trimmedName.length < 3) {
      return 'Report name must be at least 3 characters long';
    }

    if (trimmedName.length > 50) {
      return 'Report name cannot exceed 50 characters';
    }

    // Check for duplicate names
    if (existingReportNames.some(
      existingName => existingName.toLowerCase() === trimmedName.toLowerCase()
    )) {
      return 'A report with this name already exists';
    }

    // Optional: Check for valid characters (alphanumeric, spaces, some punctuation)
    const validNameRegex = /^[a-zA-Z0-9 _\-().]+$/;
    if (!validNameRegex.test(trimmedName)) {
      return 'Report name can only contain letters, numbers, spaces, and some special characters (_-().))';
    }

    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationError = validateReportName(reportName);

    if (validationError) {
      setError(validationError);
      return;
    }

    // Clear any previous errors
    setError('');
    
    // Call the onSubmit prop with the validated name
    onSubmit(reportName.trim());
    
    // Reset modal state
    setReportName('');
    onHide();
  };

  const handleClose = () => {
    setReportName('');
    setError('');
    onHide();
  };

  return (
    <Modal 
      show={show} 
      onHide={handleClose}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Name Your Report</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError('')} dismissible>
            {error}
          </Alert>
        )}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="reportNameInput">
            <Form.Label>Report Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter a name for your report"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              isInvalid={!!error}
              maxLength={50}
              required
            />
            <Form.Control.Feedback type="invalid">
              {error}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              Choose a unique name between 3-50 characters
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit}
          disabled={!reportName.trim()}
        >
          Create Report
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReportNameModal;
