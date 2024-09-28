import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { updateCompanyInfo } from '../services/api';

const CompanyInfoForm = ({ initialCompanyInfo, onCompanyInfoChange, readOnly = false }) => {
  const [companyInfo, setCompanyInfo] = useState(initialCompanyInfo || {});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (initialCompanyInfo) {
      setCompanyInfo(initialCompanyInfo);
    }
  }, [initialCompanyInfo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCompanyInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedInfo = await updateCompanyInfo(companyInfo);
      setCompanyInfo(updatedInfo);
      onCompanyInfoChange(updatedInfo);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating company info:', error);
    }
  };

  if (readOnly && !isEditing) {
    return (
      <div>
        <h4>Company Information</h4>
        <p>Name: {companyInfo.name}</p>
        <p>Address: {companyInfo.address}</p>
        <p>Phone: {companyInfo.phone}</p>
        {!readOnly && <Button onClick={() => setIsEditing(true)}>Edit</Button>}
      </div>
    );
  }

  return (
    <Form onSubmit={handleSubmit}>
      <h4>Company Information</h4>
      <Form.Group>
        <Form.Label>Company Name</Form.Label>
        <Form.Control
          type="text"
          name="name"
          value={companyInfo.name || ''}
          onChange={handleInputChange}
          disabled={readOnly && !isEditing}
        />
      </Form.Group>
      <Form.Group>
        <Form.Label>Address</Form.Label>
        <Form.Control
          type="text"
          name="address"
          value={companyInfo.address || ''}
          onChange={handleInputChange}
          disabled={readOnly && !isEditing}
        />
      </Form.Group>
      <Form.Group>
        <Form.Label>Phone</Form.Label>
        <Form.Control
          type="text"
          name="phone"
          value={companyInfo.phone || ''}
          onChange={handleInputChange}
          disabled={readOnly && !isEditing}
        />
      </Form.Group>
      {!readOnly && (
        <Button type="submit">
          {isEditing ? 'Save Changes' : 'Update Company Info'}
        </Button>
      )}
      {isEditing && <Button onClick={() => setIsEditing(false)}>Cancel</Button>}
    </Form>
  );
};

export default CompanyInfoForm;
