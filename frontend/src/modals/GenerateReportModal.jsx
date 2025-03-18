import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { generateReport } from '../services/api';
import { Modal, Button, Form } from 'react-bootstrap';

const GenerateReportModal = ({ show, handleClose, refreshReports }) => {
  const [reportData, setReportData] = useState({
    name: '',
    description: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setReportData({ ...reportData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await generateReport(reportData);
      refreshReports();
      handleClose();
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
	<Modal.Title>Generate Report</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
	  <Form.Group controlId="name">
	    <Form.Label>Name</Form.Label>
	    <Form.Control
	      type="text"
	      name="name"
	      value={reportData.name}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	  <Form.Group controlId="description">
	    <Form.Label>Description</Form.Label>
	    <Form.Control
	      type="text"
	      name="description"
	      value={reportData.description}
	      onChange={handleChange}
	      required
	    />
	  </Form.Group>
	</Modal.Body>
	<Modal.Footer>
	  <Button variant="secondary" onClick={handleClose}>
	    Close
	  </Button>
	  <Button type="submit" variant="primary">
	    Generate Report
	  </Button>
	</Modal.Footer>
      </Form>
    </Modal>
  );
};

GenerateReportModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  refreshReports: PropTypes.func.isRequired,
};

export default GenerateReportModal;
