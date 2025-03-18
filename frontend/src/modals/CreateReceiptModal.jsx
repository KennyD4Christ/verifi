import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { fetchInvoices, checkReceiptExists } from '../services/api'; // Assume this function exists or needs to be created

const CreateReceiptModal = ({ show, onHide, onSave }) => {
  const [formData, setFormData] = useState({
    invoice: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'online',
    payment_reference: '',
    notes: '',
    amount_paid: ''
  });
  
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceAmount, setSelectedInvoiceAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchingInvoices, setFetchingInvoices] = useState(false);
  const [invoicesWithReceipts, setInvoicesWithReceipts] = useState({});

  // Payment method options
  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'online', label: 'Online Payment' },
    { value: 'other', label: 'Other' }
  ];

  // Fetch all invoices when modal opens
  useEffect(() => {
    if (show) {
      loadInvoices();
    }
  }, [show]);

  const loadInvoices = async () => {
    setFetchingInvoices(true);
    try {
      // Fetch all invoices that could potentially need receipts (both sent and paid)
      const response = await fetchInvoices({ status: ['sent', 'paid'] });
      if (response && response.results) {
        setInvoices(response.results);
        
        // Check which invoices already have receipts
        const receiptStatus = {};
        await Promise.all(response.results.map(async (invoice) => {
          // This would be a new API endpoint to check if a receipt exists for an invoice
          const hasReceipt = await checkReceiptExists(invoice.id);
          receiptStatus[invoice.id] = hasReceipt;
        }));
        
        setInvoicesWithReceipts(receiptStatus);
      }
    } catch (err) {
      setError('Failed to load invoices');
      console.error('Error loading invoices:', err);
    } finally {
      setFetchingInvoices(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'invoice') {
      // Find the selected invoice to set the amount
      const selectedInvoice = invoices.find(inv => inv.id === value);
      if (selectedInvoice) {
        setSelectedInvoiceAmount(selectedInvoice.total_amount);
        // Automatically set the amount_paid to match invoice total
        setFormData(prev => ({
          ...prev,
          [name]: value,
          amount_paid: selectedInvoice.total_amount
        }));
        return;
      } else {
        setSelectedInvoiceAmount(null);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const result = await onSave(formData);
      if (result && result.success) {
        onHide();
        // Reset form data
        setFormData({
          invoice: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'online',
          payment_reference: '',
          notes: '',
          amount_paid: ''
        });
      }
    } catch (err) {
      console.error('Error creating receipt:', err);
      setError(err.response?.data?.detail || 'Failed to create receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter out invoices that already have receipts for display
  const availableInvoices = invoices.filter(invoice => !invoicesWithReceipts[invoice.id]);
  
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create New Receipt</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Invoice *</Form.Label>
            {fetchingInvoices ? (
              <div className="text-center">
                <Spinner animation="border" size="sm" />
                <span className="ms-2">Loading invoices...</span>
              </div>
            ) : (
              <>
                <Form.Select
                  name="invoice"
                  value={formData.invoice}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select an invoice</option>
                  {availableInvoices.map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      #{invoice.invoice_number} - {invoice.customer_name} - N{invoice.total_amount} - {invoice.status}
                    </option>
                  ))}
                </Form.Select>
                {invoices.length > 0 && availableInvoices.length === 0 && (
                  <Alert variant="info" className="mt-2">
                    All invoices currently have receipts. No invoices available for receipt creation.
                  </Alert>
                )}
              </>
            )}
            <Form.Text className="text-muted">
              Select an invoice to create a receipt for. Only invoices without existing receipts are shown.
            </Form.Text>
          </Form.Group>

          {selectedInvoiceAmount && (
            <Form.Group className="mb-3">
              <Form.Label>Amount Paid *</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="amount_paid"
                value={formData.amount_paid}
                onChange={handleChange}
                required
                readOnly
              />
              <Form.Text className="text-muted">
                Amount automatically set to match the invoice total
              </Form.Text>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Payment Date *</Form.Label>
            <Form.Control
              type="date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Payment Method *</Form.Label>
            <Form.Select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              required
            >
              {paymentMethodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Payment Reference</Form.Label>
            <Form.Control
              type="text"
              name="payment_reference"
              value={formData.payment_reference}
              onChange={handleChange}
              placeholder="Transaction ID, Check number, etc."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional information about this payment"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading || !formData.invoice}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" /> Creating...
              </>
            ) : (
              'Create Receipt'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CreateReceiptModal;
