const AccessDenied = () => {
  return (
    <Container className="text-center mt-5">
      <h1>Access Denied</h1>
      <p>You do not have permission to access this page.</p>
      <Button variant="primary" onClick={() => navigate('/dashboard')}>
        Return to Dashboard
      </Button>
    </Container>
  );
};
