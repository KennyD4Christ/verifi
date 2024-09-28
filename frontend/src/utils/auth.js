export const isTokenPresent = () => {
  return !!(localStorage.getItem('token'));
};

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return `Token ${token}`;
  }
  return null;
};
