import React, { useState } from 'react';
import styled from 'styled-components';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';

const StyledModal = styled(Modal)`
  .modal-content {
    border-radius: 8px;
  }
`;

const EmailReportModal = ({ show, onHide, onSubmit, report }) => {
  const [email, setEmail] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      await onSubmit({
        email,
        include_summary: includeSummary,
        include_charts: includeCharts,
        report_id: report.id
      });
      onHide();
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <StyledModal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Email Report</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Recipient Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Include Summary"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Include Charts"
              checked={includeCharts}
              onChange={(e) => setIncludeCharts(e.target.checked)}
            />
          </Form.Group>

          {error && <Alert variant="danger">{error}</Alert>}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={sending}
        >
          {sending ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Sending...
            </>
          ) : (
            'Send Email'
          )}
        </Button>
      </Modal.Footer>
    </StyledModal>
  );
};

export default EmailReportModal;
