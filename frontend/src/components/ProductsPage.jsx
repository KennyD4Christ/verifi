import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProducts, deleteProduct, createProduct, fetchCategories, bulkDeleteProducts, exportProductsCsv, exportProductsPdf } from '../services/api';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import AddProductModal from '../modals/AddProductModal';
import EditProductModal from '../modals/EditProductModal';
import ProductsChart from './ProductsChart';
import { useInView } from 'react-intersection-observer';
import { Button, Table, Form, Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import UpdateProductModal from '../modals/UpdateProductModal';
import FlippingModal from './FlippingModal';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { ThemeProvider } from "styled-components";


const getThemeValue = (path, fallback) => props => {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && acc[part] !== undefined) return acc[part];
    return undefined;
  }, props.theme);

  return value !== undefined ? value : fallback;
};

const ProductsContainer = styled(Container)`
  padding: 20px;
  height: 100%;
  min-height: calc(100vh - 60px);
  overflow-y: visible;
  display: flex;
  flex-direction: column;
  background-color: ${getThemeValue('colors.background', '#ffffff')};
  color: ${getThemeValue('colors.text.primary', '#2d3748')};
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

const StyledTable = styled(Table)`
  margin-bottom: 20px;
`;

const Filters = styled.div`
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  align-items: center;
  background-color: ${getThemeValue('colors.surface', '#1a365d')};
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const StyledFormControl = styled(Form.Control)`
  height: 38px;
  &::placeholder {
    color: #6c757d;
  }
`;

const ActionButtonContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

const ActionButton = styled(Button)`
  background-color: ${getThemeValue('colors.primary', '#1a365d')};
  color: white;
  border: none;
  padding: 10px;
  font-weight: bold;
  transition: all 0.3s ease;
  width: 100%;
  white-space: nowrap;
  font-size: clamp(0.875rem, 2vw, 1rem);
  border-radius: 12px;

  &:hover {
    background-color: #04296a;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }
`;

const SearchBar = styled(Form.Control)`
  border-radius: 20px;
  padding-left: 40px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23999" class="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>');
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 20px;
`;

const AnimatedTableRow = styled.tr`
  transition: all 0.3s ease;

  &:hover {
    background-color: #f0f8ff;
    transform: scale(1.01);
  }
`;

const PaginationContainer = styled.div`
  width: 100%;
  margin-top: auto;
  padding: 1rem;
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border-radius: 4px;
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    border-radius: 0;
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 1.5rem;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: ${getThemeValue('colors.surface', '#f7fafc')};
  border: 1px solid ${getThemeValue('colors.border', '#e2e8f0')};

  @media (max-width: 768px) {
    margin: 0 -1.5rem;
    width: calc(100% + 3rem);
    border-radius: 0;
  }

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${getThemeValue('colors.surface', '#f7fafc')};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${getThemeValue('colors.border', '#e2e8f0')};
    border-radius: 4px;

    &:hover {
      background: ${getThemeValue('colors.text.secondary', '#4a5568')};
    }
  }
`;

const ScrollToTopButton = styled(Button)`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #0645AD;
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${props => props.visible ? '1' : '0'};
  visibility: ${props => props.visible ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const ProductsPage = () => {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [categories, setCategories] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [productsPerPage] = useState(10);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  // Selected products state
  const [selectedProducts, setSelectedProducts] = useState([]);

  const fetchProductsData = useCallback(async () => {
    if (isAuthenticated()) {
      setLoading(true);
      try {
        const params = {
          page: currentPage,
          page_size: productsPerPage,
          search: searchTerm,
          category: categoryFilter,
          min_price: minPrice,
          max_price: maxPrice,
          is_active: isActiveFilter,
          ordering: `${sortDirection === 'desc' ? '-' : ''}${sortField}`
        };
        
	Object.keys(params).forEach(key => 
          (params[key] === undefined || params[key] === '') && delete params[key]
	);

        const productsData = await fetchProducts(params);
        setProducts(productsData.results);
        setTotalPages(Math.ceil(productsData.count / productsPerPage));
      } catch (error) {
        setError('Error fetching products. Please try again.');
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [isAuthenticated, currentPage, productsPerPage, searchTerm, categoryFilter, minPrice, maxPrice, isActiveFilter, sortField, sortDirection]);

  const fetchCategoriesData = useCallback(async () => {
    if (isAuthenticated()) {
      try {
        const categoriesData = await fetchCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Error fetching categories. Please try again.');
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProductsData();
    fetchCategoriesData();
  }, [fetchProductsData, fetchCategoriesData]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (event) => {
    setCategoryFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleMinPriceChange = (event) => {
    setMinPrice(event.target.value);
    setCurrentPage(1);
  };

  const handleMaxPriceChange = (event) => {
    setMaxPrice(event.target.value);
    setCurrentPage(1);
  };

  const handleIsActiveFilterChange = (event) => {
    setIsActiveFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
    setSortField(field);
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts(prevSelected => 
      prevSelected.includes(id) 
        ? prevSelected.filter(p => p !== id)
        : [...prevSelected, id]
    );
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(productId);
        setSuccess('Product deleted successfully.');
        fetchProductsData();
      } catch (error) {
        setError('Error deleting product. Please try again.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) {
      try {
        await bulkDeleteProducts(selectedProducts);
        setSuccess(`${selectedProducts.length} products deleted successfully.`);
        setSelectedProducts([]);
        fetchProductsData();
      } catch (error) {
        setError('Error deleting products. Please try again.');
      }
    }
  };

  const handleExportCsv = async () => {
    try {
      await exportProductsCsv();
      setSuccess('Products exported to CSV successfully.');
    } catch (error) {
      setError('Error exporting products to CSV. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportProductsPdf();
      setSuccess('Products exported to PDF successfully.');
    } catch (error) {
      setError('Error exporting products to PDF. Please try again.');
    }
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (!isAuthenticated()) {
    return <Alert variant="warning">Please log in to view products.</Alert>;
  }

  return (
    <ProductsContainer>
      <Heading>Products</Heading>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      <Filters>
        <StyledFormControl
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
        <StyledFormControl
          as="select"
          value={categoryFilter}
          onChange={handleCategoryFilterChange}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </StyledFormControl>
        <StyledFormControl
          type="number"
          placeholder="Min Price"
          value={minPrice}
          onChange={handleMinPriceChange}
        />
        <StyledFormControl
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={handleMaxPriceChange}
        />
        <StyledFormControl
          as="select"
          value={isActiveFilter}
          onChange={handleIsActiveFilterChange}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </StyledFormControl>
      </Filters>

      <ActionButtonContainer>
        <ActionButton onClick={() => setShowAddModal(true)}>Add Product</ActionButton>
        <ActionButton onClick={handleBulkDelete} disabled={selectedProducts.length === 0}>Delete Selected</ActionButton>
        <ActionButton onClick={handleExportCsv}>Export CSV</ActionButton>
        <ActionButton onClick={handleExportPdf}>Export PDF</ActionButton>
      </ActionButtonContainer>

      {loading ? (
        <Spinner animation="border" role="status" className="d-block mx-auto" />
      ) : (
        <>
	  <TableWrapper>
          <StyledTable striped bordered hover>
            <thead>
              <tr>
                <th><Form.Check type="checkbox" onChange={handleSelectAll} /></th>
                <th onClick={() => handleSort('name')}>Name {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => handleSort('category')}>Category {sortField === 'category' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => handleSort('price')}>Price {sortField === 'price' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => handleSort('stock')}>Stock {sortField === 'stock' && (sortDirection === 'asc' ? '▲' : '▼')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><Form.Check type="checkbox" checked={selectedProducts.includes(product.id)} onChange={() => handleSelectProduct(product.id)} /></td>
                  <td><Link to={`/products/${product.id}`}>{product.name}</Link></td>
                  <td>{product.category?.name || 'N/A'}</td>
                  <td>{product.price}</td>
                  <td>{product.stock}</td>
                  <td>
                    <Button variant="info" size="sm" onClick={() => setEditingProductId(product.id)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteProduct(product.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
	  </TableWrapper>

	  <PaginationContainer>
          <div>
            {Array.from({ length: totalPages }, (_, index) => (
              <Button key={index + 1} onClick={() => paginate(index + 1)} disabled={currentPage === index + 1}>
                {index + 1}
              </Button>
            ))}
          </div>
	  </PaginationContainer>
        </>
      )}

      <AddProductModal
        isOpen={showAddModal}
        handleClose={() => setShowAddModal(false)}
        refreshProducts={fetchProductsData}
        setSuccess={setSuccess}
        setError={setError}
      />

      {editingProductId && (
        <EditProductModal
          show={!!editingProductId}
          handleClose={() => setEditingProductId(null)}
          productId={editingProductId}
          refreshProducts={fetchProductsData}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}
    </ProductsContainer>
  );
};

export default ProductsPage;
